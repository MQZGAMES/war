-- Mesa de Guerra 3D: save na nuvem.
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  mundo      jsonb       not null,
  heroi      text        not null default '',
  nivel      int         not null default 0,
  atualizado timestamptz not null default now()
);

-- Expõe a tabela só para quem entrou na conta (vale também com
-- "Automatically expose new tables" desligado no projeto).
revoke all on public.saves from anon;
grant select, insert, update, delete on public.saves to authenticated;

-- Cada jogador só enxerga e altera a própria linha.
alter table public.saves enable row level security;

drop policy if exists "ler o proprio save" on public.saves;
create policy "ler o proprio save" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "criar o proprio save" on public.saves;
create policy "criar o proprio save" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "atualizar o proprio save" on public.saves;
create policy "atualizar o proprio save" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "apagar o proprio save" on public.saves;
create policy "apagar o proprio save" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Um save acima de ~3 MB é recusado (o de um mundo grande fica perto de 200 KB).
alter table public.saves drop constraint if exists saves_tamanho;
alter table public.saves add constraint saves_tamanho check (pg_column_size(mundo) < 3000000);
