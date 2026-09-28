-- Mesa de Guerra 3D: conta = e-mail + senha; dentro dela, até 10 personagens,
-- cada um com a sua partida salva.
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem perder nada.
--
-- A senha vira hash bcrypt (pgcrypto) e nunca volta ao aparelho. Ao entrar, o
-- servidor devolve um token de sessão; no banco fica só o sha256 dele. As
-- tabelas não têm acesso direto: tudo passa pelas funções mdc_*. Cinco senhas
-- erradas seguidas travam a conta por 5 minutos.
-- As contas por usuário (supabase/contas.sql) que tinham e-mail são trazidas
-- para cá: cada uma vira um personagem da conta desse e-mail.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mdc_contas (
  email       text        primary key check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 120),
  senha_hash  text        not null,
  criado      timestamptz not null default now(),
  falhas      int         not null default 0,
  bloqueio    timestamptz
);
create table if not exists public.mdc_personagens (
  id          bigint generated always as identity primary key,
  email       text        not null references public.mdc_contas (email) on delete cascade on update cascade,
  nome        text        not null default '',
  vocacao     text        not null default '',
  nivel       int         not null default 1,
  mundo       jsonb,
  atualizado  timestamptz,
  criado      timestamptz not null default now(),
  origem      text        unique
);
create index if not exists mdc_personagens_email on public.mdc_personagens (email);
alter table public.mdc_personagens drop constraint if exists mdc_personagens_tamanho;
alter table public.mdc_personagens add constraint mdc_personagens_tamanho check (mundo is null or pg_column_size(mundo) < 3000000);

create table if not exists public.mdc_sessoes (
  token_hash  bytea       primary key,
  email       text        not null references public.mdc_contas (email) on delete cascade on update cascade,
  criado      timestamptz not null default now(),
  visto       timestamptz not null default now()
);
create index if not exists mdc_sessoes_email on public.mdc_sessoes (email);

alter table public.mdc_contas enable row level security;
alter table public.mdc_personagens enable row level security;
alter table public.mdc_sessoes enable row level security;
revoke all on public.mdc_contas from anon, authenticated;
revoke all on public.mdc_personagens from anon, authenticated;
revoke all on public.mdc_sessoes from anon, authenticated;

-- ---------- migração das contas por usuário que tinham e-mail ----------
do $$
begin
  if to_regclass('public.contas_jogo') is not null then
    -- a senha que vale é a da conta usada por último naquele e-mail
    insert into mdc_contas (email, senha_hash)
      select distinct on (email) email, senha_hash from contas_jogo
      where email is not null order by email, atualizado desc nulls last, criado desc
    on conflict (email) do nothing;
    insert into mdc_personagens (email, nome, nivel, mundo, atualizado, origem)
      select c.email, coalesce(nullif(c.heroi, ''), c.usuario), c.nivel, c.mundo, c.atualizado, 'usuario:' || c.usuario
      from contas_jogo c
      where c.email is not null and c.mundo is not null
        and (select count(*) from mdc_personagens p where p.email = c.email) < 10
    on conflict (origem) do nothing;
  end if;
end $$;

-- ---------- internas ----------
create or replace function public.mdc_nova_sessao(p_email text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  t := encode(gen_random_bytes(32), 'hex');
  insert into mdc_sessoes (token_hash, email) values (digest(t, 'sha256'), p_email);
  delete from mdc_sessoes s where s.email = p_email and s.token_hash not in
    (select token_hash from mdc_sessoes where email = p_email order by visto desc limit 10);
  delete from mdc_sessoes where visto < now() - interval '120 days';
  return t;
end $$;

create or replace function public.mdc_da_sessao(p_token text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare e text;
begin
  update mdc_sessoes set visto = now() where token_hash = digest(coalesce(p_token, ''), 'sha256') returning email into e;
  if e is null then raise exception 'SESSAO_INVALIDA'; end if;
  return e;
end $$;

create or replace function public.mdc_lista(p_email text) returns json
language sql security definer set search_path = public, extensions as $$
  select coalesce(json_agg(json_build_object('id', id, 'nome', nome, 'vocacao', vocacao, 'nivel', nivel,
    'atualizado', atualizado, 'salvo', mundo is not null) order by atualizado desc nulls last, id), '[]'::json)
  from mdc_personagens where email = p_email;
$$;

revoke all on function public.mdc_nova_sessao(text) from public, anon, authenticated;
revoke all on function public.mdc_da_sessao(text) from public, anon, authenticated;
revoke all on function public.mdc_lista(text) from public, anon, authenticated;

-- ---------- conta ----------
create or replace function public.mdc_criar_conta(p_email text, p_senha text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 120 then raise exception 'EMAIL_INVALIDO'; end if;
  if length(coalesce(p_senha, '')) < 6 or length(p_senha) > 72 then raise exception 'SENHA_CURTA'; end if;
  begin
    insert into mdc_contas (email, senha_hash) values (e, crypt(p_senha, gen_salt('bf', 8)));
  exception when unique_violation then
    raise exception 'EMAIL_EXISTE';
  end;
  return json_build_object('email', e, 'token', mdc_nova_sessao(e), 'personagens', mdc_lista(e));
end $$;

-- senha errada volta como {erro} (sem exceção) para a contagem de falhas valer
create or replace function public.mdc_entrar(p_email text, p_senha text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  c mdc_contas%rowtype;
  n int;
begin
  select * into c from mdc_contas where email = e;
  if not found then return json_build_object('erro', 'LOGIN_INVALIDO'); end if;
  if c.bloqueio is not null and c.bloqueio > now() then return json_build_object('erro', 'BLOQUEADO'); end if;
  if c.senha_hash <> crypt(coalesce(p_senha, ''), c.senha_hash) then
    n := case when c.falhas >= 5 then 1 else c.falhas + 1 end;
    update mdc_contas set falhas = n, bloqueio = case when n >= 5 then now() + interval '5 minutes' else null end where email = e;
    return json_build_object('erro', case when n >= 5 then 'BLOQUEADO' else 'LOGIN_INVALIDO' end);
  end if;
  update mdc_contas set falhas = 0, bloqueio = null where email = e;
  return json_build_object('email', e, 'token', mdc_nova_sessao(e), 'personagens', mdc_lista(e));
end $$;

create or replace function public.mdc_personagens(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := mdc_da_sessao(p_token);
begin
  return json_build_object('email', e, 'personagens', mdc_lista(e));
end $$;

create or replace function public.mdc_trocar_senha(p_token text, p_atual text, p_nova text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := mdc_da_sessao(p_token); h text;
begin
  select senha_hash into h from mdc_contas where email = e;
  if h <> crypt(coalesce(p_atual, ''), h) then return json_build_object('erro', 'LOGIN_INVALIDO'); end if;
  if length(coalesce(p_nova, '')) < 6 or length(p_nova) > 72 then raise exception 'SENHA_CURTA'; end if;
  update mdc_contas set senha_hash = crypt(p_nova, gen_salt('bf', 8)) where email = e;
  delete from mdc_sessoes where email = e and token_hash <> digest(p_token, 'sha256');
  return json_build_object('ok', true);
end $$;

create or replace function public.mdc_sair(p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from mdc_sessoes where token_hash = digest(coalesce(p_token, ''), 'sha256');
end $$;

-- ---------- personagens (até 10 por conta) ----------
create or replace function public.mdc_novo_personagem(p_token text, p_nome text, p_vocacao text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := mdc_da_sessao(p_token); novo bigint;
begin
  perform 1 from mdc_contas where email = e for update;
  if (select count(*) from mdc_personagens where email = e) >= 10 then raise exception 'LIMITE_PERSONAGENS'; end if;
  insert into mdc_personagens (email, nome, vocacao) values (e, left(coalesce(p_nome, ''), 40), left(coalesce(p_vocacao, ''), 20))
    returning id into novo;
  return json_build_object('id', novo, 'personagens', mdc_lista(e));
end $$;

create or replace function public.mdc_salvar(p_token text, p_id bigint, p_mundo jsonb, p_nome text, p_vocacao text, p_nivel int) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := mdc_da_sessao(p_token); agora timestamptz := now();
begin
  update mdc_personagens set mundo = p_mundo, nome = left(coalesce(p_nome, nome), 40), vocacao = left(coalesce(p_vocacao, vocacao), 20),
    nivel = coalesce(p_nivel, nivel), atualizado = agora
    where id = p_id and email = e;
  if not found then raise exception 'PERSONAGEM_INVALIDO'; end if;
  return json_build_object('atualizado', agora);
end $$;

create or replace function public.mdc_carregar(p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := mdc_da_sessao(p_token); m jsonb;
begin
  select mundo into m from mdc_personagens where id = p_id and email = e;
  if not found then raise exception 'PERSONAGEM_INVALIDO'; end if;
  return m;
end $$;

create or replace function public.mdc_excluir_personagem(p_token text, p_id bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := mdc_da_sessao(p_token);
begin
  delete from mdc_personagens where id = p_id and email = e;
  return json_build_object('personagens', mdc_lista(e));
end $$;

-- trocar o nome de um personagem da conta (1 a 18 letras)
create or replace function public.mdc_renomear_personagem(p_token text, p_id bigint, p_nome text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare e text := mdc_da_sessao(p_token); n text := trim(coalesce(p_nome, ''));
begin
  if length(n) < 1 or length(n) > 18 then raise exception 'NOME_INVALIDO'; end if;
  update mdc_personagens set nome = n where id = p_id and email = e;
  if not found then raise exception 'PERSONAGEM_INVALIDO'; end if;
  return json_build_object('personagens', mdc_lista(e));
end $$;

grant execute on function public.mdc_renomear_personagem(text, bigint, text) to anon, authenticated;
grant execute on function public.mdc_criar_conta(text, text) to anon, authenticated;
grant execute on function public.mdc_entrar(text, text) to anon, authenticated;
grant execute on function public.mdc_personagens(text) to anon, authenticated;
grant execute on function public.mdc_trocar_senha(text, text, text) to anon, authenticated;
grant execute on function public.mdc_sair(text) to anon, authenticated;
grant execute on function public.mdc_novo_personagem(text, text, text) to anon, authenticated;
grant execute on function public.mdc_salvar(text, bigint, jsonb, text, text, int) to anon, authenticated;
grant execute on function public.mdc_carregar(text, bigint) to anon, authenticated;
grant execute on function public.mdc_excluir_personagem(text, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
