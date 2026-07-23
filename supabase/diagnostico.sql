-- ==================================================================
-- Diagnóstico — a quem pertence cada exploração?
-- ==================================================================
-- Correr no SQL Editor do projeto de TESTES. Só lê, não altera nada.
-- Não é preciso editar nada: mostra TODAS as contas e TODAS as explorações.
--
-- A app mostra uma exploração quando existe uma linha em `membro_exploracao`
-- para o utilizador com sessão iniciada — não basta o `user_id` da exploração
-- (é o que a RLS `exploracao_membros_read` → `membro_de(id)` pergunta).
--
-- Lê a tabela 2 de cima a baixo: se as explorações `demo-` pertencerem a uma
-- conta e a que aparece na app a outra, está encontrado.
-- ==================================================================

-- ---- 1. Contas existentes ----------------------------------------
select
  'CONTA' as tabela,
  u.email,
  u.id::text as user_id,
  coalesce(p.estado, '(sem perfil)') as estado,
  coalesce(p.is_superadmin::text, '—') as superadmin,
  u.created_at::date::text as criada_em,
  u.last_sign_in_at::date::text as ultima_entrada
from auth.users u
left join public.perfil p on p.id = u.id
order by u.created_at;


-- ---- 2. Explorações, dono, e quem lhes tem acesso -----------------
-- `acesso_de` é a coluna que decide o que a app mostra. Uma exploração com
-- `acesso_de` vazio não é vista por ninguém, por muito que o `dono` esteja
-- correto.
select
  'EXPLORAÇÃO' as tabela,
  e.id,
  e.nome,
  e.localizacao,
  coalesce(dono.email, '(órfã)') as dono,
  coalesce(
    (select string_agg(mu.email || ' (' || m.role || ')', ', ')
       from public.membro_exploracao m
       join auth.users mu on mu.id = m.user_id
      where m.exploracao_id = e.id),
    '>>> NINGUÉM — a app não a mostra <<<'
  ) as acesso_de,
  (select count(*) from public.animal a where a.exploracao_id = e.id) as animais,
  (select count(*) from public.terreno t where t.exploracao_id = e.id) as terrenos
from public.exploracao e
left join auth.users dono on dono.id = e.user_id
order by e.id;


-- ---- 3. O que cada conta vê na app -------------------------------
-- Simula a pergunta que a RLS faz, conta a conta. É este o número que tem de
-- bater certo com o "Resumo" do ecrã Início.
select
  'O QUE A APP MOSTRA' as tabela,
  u.email,
  count(distinct m.exploracao_id) as exploracoes_visiveis,
  (select count(*) from public.animal a
    where a.exploracao_id in (
      select m2.exploracao_id from public.membro_exploracao m2 where m2.user_id = u.id
    )) as animais_visiveis,
  (select count(*) from public.terreno t
    where t.exploracao_id in (
      select m2.exploracao_id from public.membro_exploracao m2 where m2.user_id = u.id
    )) as terrenos_visiveis
from auth.users u
left join public.membro_exploracao m on m.user_id = u.id
left join public.perfil p on p.id = u.id
where coalesce(p.is_superadmin, false) = false
group by u.id, u.email
order by u.email;
