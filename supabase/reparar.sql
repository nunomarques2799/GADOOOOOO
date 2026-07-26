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
-- 0b. DIAGNÓSTICO — quando o estado está 'ativo' e a RLS recusa à mesma
-- ------------------------------------------------------------------
-- O SQL Editor corre como `postgres`, que passa por cima da RLS: um INSERT
-- feito aqui à mão funciona sempre e não prova nada. Estes dois blocos são a
-- forma de ver o que a app vê.

-- Que políticas existem MESMO nesta base. A de INSERT tem de ser a
-- `exploracao_ativo_insert`. Se aparecer uma `... for all` a exigir
-- `role_em(id) = 'admin'`, está encontrado: ao criar a exploração ainda não há
-- linha em `membro_exploracao` (é o trigger que a cria, logo A SEGUIR ao
-- insert), portanto essa política recusa sempre a primeira exploração. Sinal
-- de que o `schema_roles.sql` desta base é anterior ao do repositório —
-- reaplicá-lo resolve, e é idempotente.
select policyname, cmd,
       coalesce(qual, '—') as using_expr,
       coalesce(with_check, '—') as with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'exploracao'
 order by cmd, policyname;

-- Repetir o INSERT exatamente como a app o faz, na pele da conta indicada.
-- Faz `rollback` no fim: não deixa nada para trás, mesmo quando corre bem.
begin;
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', (select id from auth.users where lower(email) = lower('escrever@aqui.pt')),
      'role', 'authenticated'
    )::text,
    true) as claims_definidas;
  set local role authenticated;

  -- As duas metades da política, em separado. Se `perfil_ativo` vier false com
  -- o estado a dizer 'ativo', a função é que está velha (reaplicar o
  -- `schema_roles.sql`); se `uid` vier NULL, o email acima não existe.
  select auth.uid() as uid, public.perfil_ativo() as perfil_ativo;

  insert into public.exploracao (id, nome, marca_exploracao, nif_detentor)
  values ('rls-teste', 'Teste RLS', 'XX0000', '000000000');
rollback;


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

-- Variante SÓ PARA O PROJETO DE TESTES: ativa todas as contas de uma vez.
-- Poupa o passo de acertar o email — que é onde isto costuma falhar em
-- silêncio, porque um email que não existe faz o UPDATE mexer em zero linhas e
-- não dá erro nenhum. Confirmar a faixa "TESTES" na app antes de correr; em
-- produção, aprovar às cegas era dar a plataforma a quem se registou.
--
--   update public.perfil set estado = 'ativo' where estado <> 'ativo';


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
