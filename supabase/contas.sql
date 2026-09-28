-- Mesa de Guerra 3D: conta com usuário e senha (sem e-mail) e o save na nuvem.
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem perder nada (tudo é "if not exists" / "or replace").
--
-- Como funciona: a senha vira hash bcrypt (pgcrypto) e nunca volta ao
-- aparelho. Ao entrar, o servidor devolve um token de sessão; no banco
-- fica só o sha256 dele. As tabelas não têm acesso direto: tudo passa
-- pelas funções mdg_* abaixo. Cinco senhas erradas seguidas travam a
-- conta por 5 minutos. O e-mail é opcional no banco e pode se repetir:
-- um e-mail junta várias contas (até 10).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.contas_jogo (
  usuario     text primary key check (usuario ~ '^[a-z0-9_.-]{3,20}$'),
  senha_hash  text        not null,
  mundo       jsonb,
  heroi       text        not null default '',
  nivel       int         not null default 0,
  atualizado  timestamptz,
  criado      timestamptz not null default now(),
  falhas      int         not null default 0,
  bloqueio    timestamptz
);
-- E-mail da conta: não é único, um e-mail pode ter várias contas (até 10).
alter table public.contas_jogo add column if not exists email text;
alter table public.contas_jogo drop constraint if exists contas_jogo_email;
alter table public.contas_jogo add constraint contas_jogo_email check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
create index if not exists contas_jogo_email_idx on public.contas_jogo (email);
-- Um save acima de ~3 MB é recusado (o de um mundo grande fica bem abaixo).
alter table public.contas_jogo drop constraint if exists contas_jogo_tamanho;
alter table public.contas_jogo add constraint contas_jogo_tamanho check (mundo is null or pg_column_size(mundo) < 3000000);

create table if not exists public.sessoes_jogo (
  token_hash  bytea       primary key,
  usuario     text        not null references public.contas_jogo (usuario) on delete cascade,
  criado      timestamptz not null default now(),
  visto       timestamptz not null default now()
);
create index if not exists sessoes_jogo_usuario on public.sessoes_jogo (usuario);

-- Nenhum acesso direto às tabelas: só pelas funções.
alter table public.contas_jogo enable row level security;
alter table public.sessoes_jogo enable row level security;
revoke all on public.contas_jogo from anon, authenticated;
revoke all on public.sessoes_jogo from anon, authenticated;

-- ---------- internas ----------
create or replace function public.mdg_nova_sessao(p_usuario text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  t := encode(gen_random_bytes(32), 'hex');
  insert into sessoes_jogo (token_hash, usuario) values (digest(t, 'sha256'), p_usuario);
  -- até 10 aparelhos por conta; sessão esquecida há 120 dias cai
  delete from sessoes_jogo s where s.usuario = p_usuario and s.token_hash not in
    (select token_hash from sessoes_jogo where usuario = p_usuario order by visto desc limit 10);
  delete from sessoes_jogo where visto < now() - interval '120 days';
  return t;
end $$;

create or replace function public.mdg_da_sessao(p_token text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare u text;
begin
  update sessoes_jogo set visto = now() where token_hash = digest(coalesce(p_token, ''), 'sha256') returning usuario into u;
  if u is null then raise exception 'SESSAO_INVALIDA'; end if;
  return u;
end $$;

revoke all on function public.mdg_nova_sessao(text) from public, anon, authenticated;
revoke all on function public.mdg_da_sessao(text) from public, anon, authenticated;

-- ---------- públicas ----------
drop function if exists public.mdg_criar_conta(text, text);
create or replace function public.mdg_criar_conta(p_usuario text, p_senha text, p_email text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  u text := lower(trim(coalesce(p_usuario, '')));
  e text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if u !~ '^[a-z0-9_.-]{3,20}$' then raise exception 'USUARIO_INVALIDO'; end if;
  if length(coalesce(p_senha, '')) < 6 or length(p_senha) > 72 then raise exception 'SENHA_CURTA'; end if;
  if e is not null and (e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 120) then raise exception 'EMAIL_INVALIDO'; end if;
  if e is not null and (select count(*) from contas_jogo where email = e) >= 10 then raise exception 'EMAIL_CHEIO'; end if;
  begin
    insert into contas_jogo (usuario, senha_hash, email) values (u, crypt(p_senha, gen_salt('bf', 8)), e);
  exception when unique_violation then
    raise exception 'USUARIO_EXISTE';
  end;
  return json_build_object('usuario', u, 'token', mdg_nova_sessao(u));
end $$;

-- erro de senha volta como {erro} (sem exceção) para a contagem de falhas valer
create or replace function public.mdg_entrar(p_usuario text, p_senha text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  u text := lower(trim(coalesce(p_usuario, '')));
  c contas_jogo%rowtype;
  n int;
begin
  select * into c from contas_jogo where usuario = u;
  if not found then return json_build_object('erro', 'LOGIN_INVALIDO'); end if;
  if c.bloqueio is not null and c.bloqueio > now() then return json_build_object('erro', 'BLOQUEADO'); end if;
  if c.senha_hash <> crypt(coalesce(p_senha, ''), c.senha_hash) then
    n := case when c.falhas >= 5 then 1 else c.falhas + 1 end;
    update contas_jogo set falhas = n, bloqueio = case when n >= 5 then now() + interval '5 minutes' else null end where usuario = u;
    return json_build_object('erro', case when n >= 5 then 'BLOQUEADO' else 'LOGIN_INVALIDO' end);
  end if;
  update contas_jogo set falhas = 0, bloqueio = null where usuario = u;
  return json_build_object('usuario', u, 'token', mdg_nova_sessao(u), 'heroi', c.heroi, 'nivel', c.nivel, 'atualizado', c.atualizado, 'email', c.email);
end $$;

create or replace function public.mdg_meta(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := mdg_da_sessao(p_token); r json;
begin
  select json_build_object('usuario', usuario, 'heroi', heroi, 'nivel', nivel, 'atualizado', atualizado, 'email', email,
    'outras', (select coalesce(json_agg(o.usuario order by o.usuario), '[]'::json) from contas_jogo o where o.email = c.email and o.usuario <> c.usuario))
    into r from contas_jogo c where usuario = u;
  return r;
end $$;

-- cadastrar ou trocar o e-mail da conta (pede a senha)
create or replace function public.mdg_trocar_email(p_token text, p_senha text, p_email text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  u text := mdg_da_sessao(p_token); h text;
  e text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  select senha_hash into h from contas_jogo where usuario = u;
  if h <> crypt(coalesce(p_senha, ''), h) then return json_build_object('erro', 'LOGIN_INVALIDO'); end if;
  if e is not null and (e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 120) then raise exception 'EMAIL_INVALIDO'; end if;
  if e is not null and (select count(*) from contas_jogo where email = e and usuario <> u) >= 10 then raise exception 'EMAIL_CHEIO'; end if;
  update contas_jogo set email = e where usuario = u;
  return json_build_object('ok', true, 'email', e);
end $$;

create or replace function public.mdg_salvar(p_token text, p_mundo jsonb, p_heroi text, p_nivel int) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := mdg_da_sessao(p_token); agora timestamptz := now();
begin
  update contas_jogo set mundo = p_mundo, heroi = left(coalesce(p_heroi, ''), 40), nivel = coalesce(p_nivel, 0), atualizado = agora
    where usuario = u;
  return json_build_object('atualizado', agora);
end $$;

create or replace function public.mdg_carregar(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u text := mdg_da_sessao(p_token); m jsonb;
begin
  select mundo into m from contas_jogo where usuario = u;
  return m;
end $$;

create or replace function public.mdg_sair(p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from sessoes_jogo where token_hash = digest(coalesce(p_token, ''), 'sha256');
end $$;

create or replace function public.mdg_trocar_senha(p_token text, p_atual text, p_nova text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u text := mdg_da_sessao(p_token); h text;
begin
  select senha_hash into h from contas_jogo where usuario = u;
  if h <> crypt(coalesce(p_atual, ''), h) then return json_build_object('erro', 'LOGIN_INVALIDO'); end if;
  if length(coalesce(p_nova, '')) < 6 or length(p_nova) > 72 then raise exception 'SENHA_CURTA'; end if;
  update contas_jogo set senha_hash = crypt(p_nova, gen_salt('bf', 8)) where usuario = u;
  -- os outros aparelhos saem; este continua conectado
  delete from sessoes_jogo where usuario = u and token_hash <> digest(p_token, 'sha256');
  return json_build_object('ok', true);
end $$;

grant execute on function public.mdg_criar_conta(text, text, text) to anon, authenticated;
grant execute on function public.mdg_trocar_email(text, text, text) to anon, authenticated;
grant execute on function public.mdg_entrar(text, text) to anon, authenticated;
grant execute on function public.mdg_meta(text) to anon, authenticated;
grant execute on function public.mdg_salvar(text, jsonb, text, int) to anon, authenticated;
grant execute on function public.mdg_carregar(text) to anon, authenticated;
grant execute on function public.mdg_sair(text) to anon, authenticated;
grant execute on function public.mdg_trocar_senha(text, text, text) to anon, authenticated;

-- a API passa a enxergar as funções novas na hora
notify pgrst, 'reload schema';
