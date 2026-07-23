-- ==================================================================
-- Gestão de Gado — notas pessoais do utilizador
-- ==================================================================
-- Aplica depois dos anteriores. Idempotente (safe re-runs).
--
-- Notas de texto livre, PESSOAIS: cada utilizador só vê e gere as suas. Não
-- pertencem à exploração nem são partilhadas com a equipa — é o bloco de
-- apontamentos de quem usa a app. Ver `src/data/notas.ts`.
--
-- CORRER PRIMEIRO NO PROJETO DE DEV, depois em produção com backup feito
-- (ver AMBIENTES.md e supabase/MIGRACOES.md).
-- ==================================================================

create extension if not exists pgcrypto;

create table if not exists public.nota (
  id uuid primary key default gen_random_uuid(),
  -- Default auth.uid(): o cliente não precisa de o enviar, e a RLS garante que
  -- ninguém escreve notas em nome de outro.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text,
  texto text not null default '',
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nota_user on public.nota (user_id);

-- ---- RLS: cada um só as suas ----
alter table public.nota enable row level security;

drop policy if exists nota_self on public.nota;
create policy nota_self on public.nota
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- updated_at a cada alteração ----
-- Reutiliza a função de schema_versoes.sql; recriada aqui (create or replace)
-- para este ficheiro poder correr mesmo que aquele ainda não tenha corrido.
create or replace function public.toca_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_updated_at on public.nota;
create trigger trg_updated_at before update on public.nota
  for each row execute function public.toca_updated_at();

-- ==================================================================
-- VERIFICAR
-- ==================================================================
--   select count(*) from public.nota;                      -- 0 no início
--   insert into public.nota (texto) values ('teste');       -- usa auth.uid()
--   select id, user_id, texto, updated_at from public.nota; -- só as tuas
