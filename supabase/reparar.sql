-- ==================================================================
-- Gestão de Gado — reparações a uma base já criada
-- ==================================================================
-- Isto NÃO é um ficheiro de schema (não entra no `ordem.txt` nem no
-- `_completo.sql`). São as correções que fazem falta quando a base existe mas
-- a app dá erro por causa do ESTADO dos dados, não do desenho das tabelas.
--
-- Cada bloco é independente e idempotente: corre o que precisares, pela ordem
-- que quiseres, as vezes que quiseres. Correr no SQL Editor do projeto.
--
-- ⚠️ Em PRODUÇÃO: backup primeiro (`scripts/backup.ps1 -Ambiente prod`), e o
-- bloco 3 (aprovar conta) é uma decisão comercial, não uma reparação.
-- ==================================================================


-- ------------------------------------------------------------------
-- 0. DIAGNÓSTICO — correr isto primeiro, e ler antes de mudar nada
-- ------------------------------------------------------------------
-- Coluna a coluna:
--   estado = 'pendente' .... a conta não pode criar explorações. É a causa do
--                            erro "new row violates row-level security policy
--                            for table exploracao": a política
--                            `exploracao_ativo_insert` exige `perfil_ativo()`,
--                            e essa função só diz sim a `estado = 'ativo'`.
--                            Nota: ser superadmin NÃO dá a volta a esta —
--                            a política de INSERT não abre exceção a ninguém.
--   estado = '(sem perfil)'  a conta foi criada antes de o trigger
--                            `on_auth_user_created` existir. Mesmo efeito, e
--                            resolve-se no bloco 1.
select
  u.email,
  coalesce(p.estado, '(sem perfil)') as estado,
  p.is_superadmin,
  (select count(*) from public.membro_exploracao m where m.user_id = u.id) as explorações,
  u.created_at::date::text as conta_criada_em
from auth.users u
left join public.perfil p on p.id = u.id
order by u.created_at;

-- As colunas que a app grava no animal já existem?
-- Se alguma linha faltar aqui, falta aplicar `schema_animal_campos.sql`.
select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'animal'
   and column_name in ('casa', 'numero_casa', 'finalidade')
 order by column_name;


-- ------------------------------------------------------------------
-- 1. Perfis em falta — contas criadas antes de o trigger existir
-- ------------------------------------------------------------------
-- Sem linha em `perfil`, a conta entra na app e não consegue escrever nada:
-- `perfil_ativo()` devolve false por omissão. Ficam em 'pendente', que é o
-- estado certo — aprovar é uma decisão, não uma reparação (bloco 3).
insert into public.perfil (id, nome)
select u.id, coalesce(u.raw_user_meta_data ->> 'nome', '')
  from auth.users u
  left join public.perfil p on p.id = u.id
 where p.id is null;


-- ------------------------------------------------------------------
-- 2. Um superadmin está sempre ativo (regra de sanidade)
-- ------------------------------------------------------------------
-- Já está em `schema_roles.sql`, mas só corre no momento em que se aplica o
-- ficheiro. Marcar `is_superadmin = true` à mão DEPOIS disso deixa a conta
-- superadmin e 'pendente' ao mesmo tempo — e é a combinação mais confusa que
-- há: a app dá-lhe acesso a tudo (o portão de aprovação deixa passar quem é
-- superadmin) e o servidor recusa-lhe a criação de explorações.
update public.perfil set estado = 'ativo' where is_superadmin and estado <> 'ativo';


-- ------------------------------------------------------------------
-- 3. Aprovar uma conta (o que o painel de superadmin faz por botão)
-- ------------------------------------------------------------------
-- Trocar o email. Em produção isto faz-se no painel, não aqui.
update public.perfil
   set estado = 'ativo'
 where id = (select id from auth.users where lower(email) = lower('escrever@aqui.pt'));


-- ------------------------------------------------------------------
-- 4. Recarregar a cache de schema do PostgREST
-- ------------------------------------------------------------------
-- A API do Supabase não fala com o Postgres a cada pedido: guarda uma cópia da
-- lista de tabelas e colunas. Enquanto essa cópia estiver velha, gravar um
-- animal falha com "Could not find the 'casa' column of 'animal' in the schema
-- cache" — a coluna existe, quem não sabe dela é a API. Normalmente recarrega
-- sozinha uns segundos depois do DDL; isto força.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- CONFERIR
-- ------------------------------------------------------------------
-- Voltar a correr o bloco 0. A conta que interessa tem de aparecer com
-- estado = 'ativo'. Depois, na app: recarregar a página (F5) — o estado do
-- perfil é lido no arranque e fica em cache local.
