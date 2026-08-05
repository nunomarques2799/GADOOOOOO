-- ==================================================================
-- Terrabovina — a equipa à vista do superadmin, e a foto no perfil
-- ==================================================================
-- Aplica DEPOIS de schema_superadmin.sql (3) e schema_acesso_temporario.sql
-- (15). Idempotente.
--
-- Duas coisas pequenas e sem relação uma com a outra, no mesmo ficheiro por
-- serem ambas de uma linha de schema cada. Se alguma crescer, separa-se.
--
--   1. O superadmin passa a ver QUEM trabalha em cada exploração. Via o
--      cliente, as explorações dele, os terrenos e os animais — e não via as
--      pessoas. Quando o criador telefona a dizer "o veterinário não consegue
--      registar a vacina", a primeira pergunta é se ele ainda lá está e com que
--      papel, e não havia onde a responder sem abrir a base de dados à mão.
--
--   2. Cada conta passa a poder ter fotografia.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. A equipa de uma exploração, para o painel do superadmin
-- ------------------------------------------------------------------
-- Mesmo molde dos outros `superadmin_*`: SECURITY DEFINER com `eh_superadmin()`
-- à cabeça. É `security definer` por duas razões, e ambas contam:
--
--   - `membro_exploracao` só se lê a si próprio pela RLS normal;
--   - o email vive em `auth.users`, que não é legível por RLS nenhuma.
--
-- Devolve TAMBÉM os vínculos com o prazo esgotado, com o `expira_em` à frente
-- para o painel os poder esbater. É a informação que responde à pergunta que se
-- faz de facto — "porque é que ele não consegue registar nada?" —, e filtrá-los
-- aqui dava uma lista onde o veterinário de ontem simplesmente não existe.
create or replace function public.superadmin_membros_exploracao(exp_id text)
returns table (
  membro_id uuid,
  user_id uuid,
  nome text,
  email text,
  role public.role_membro,
  criado_em timestamptz,
  expira_em timestamptz,
  permissoes jsonb
)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query
    select
      m.id,
      m.user_id,
      coalesce(nullif(btrim(p.nome), ''), 'Sem nome')::text,
      coalesce(u.email, '')::text,
      m.role,
      m.criado_em,
      m.expira_em,
      m.permissoes
    from public.membro_exploracao m
    left join public.perfil p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.exploracao_id = exp_id
    -- O dono primeiro, depois os trabalhadores, depois as visitas; dentro de
    -- cada grupo por nome. É a ordem por que se procura uma pessoa numa lista.
    order by case m.role when 'admin' then 0 when 'trabalhador' then 1 else 2 end,
             coalesce(nullif(btrim(p.nome), ''), 'Sem nome');
end;
$$;

revoke all     on function public.superadmin_membros_exploracao(text) from public, anon;
grant  execute on function public.superadmin_membros_exploracao(text) to authenticated;


-- ------------------------------------------------------------------
-- 2. Fotografia da conta
-- ------------------------------------------------------------------
-- Data URI JPEG reduzido a ~400px, guardado na própria coluna — a mesma via da
-- foto do animal e do terreno (ver `src/data/foto.ts`), e NÃO o Storage que os
-- documentos usam.
--
-- A diferença que decide: um documento é um de muitos e vão-se acumulando; uma
-- foto de perfil é UMA por conta e fica sempre do mesmo tamanho (~25 KB). Não
-- há aqui nada que cresça, portanto não há razão para pagar o preço do bucket —
-- pedir uma ligação assinada de cada vez que se quer desenhar o avatar seria um
-- pedido de rede para mostrar a cara de quem já está com sessão aberta.
alter table public.perfil add column if not exists fotografia text;

-- A RLS de `perfil` já está: `perfil_self_select` deixa cada um ver a SUA linha.
-- Isso quer dizer que, para já, a fotografia é só para o próprio ver — a lista
-- de Trabalhadores continua a mostrar iniciais aos colegas, porque os nomes
-- dela vêm do `nomes_da_equipa()` e não da tabela. Para as fotos aparecerem à
-- equipa, é a essa função que se acrescentaria a coluna. Fica por fazer de
-- propósito: é uma decisão sobre o que cada um mostra aos outros, e não uma
-- consequência de se poder escolher uma foto para si.


-- ------------------------------------------------------------------
-- Coluna e função novas: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- 1. Como superadmin, a equipa de uma exploração:
--
--   select nome, email, role, expira_em
--     from public.superadmin_membros_exploracao('<exploracao>');
--
-- 2. Como utilizador normal, recusa:
--
--   -- (com request.jwt.claims de um cliente qualquer)
--   select * from public.superadmin_membros_exploracao('<exploracao>');
--   -- ERROR: sem permissão
--
-- 3. A coluna existe e cada um só vê a sua:
--
--   select id, length(fotografia) from public.perfil;
