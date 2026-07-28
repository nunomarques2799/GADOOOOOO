-- ==================================================================
-- Estado do schema — o que é que ESTA base já tem?
-- ==================================================================
-- SÓ LÊ. Não altera nada, pode correr-se em produção sem medo.
--
-- Existe porque a ordem dos ficheiros (MIGRACOES.md) diz por que ordem se
-- aplicam, mas não diz onde é que cada base ficou. Antes de aplicar seja o que
-- for em produção é preciso saber o que já lá está: aplicar o 13.º antes do
-- 10.º não dá erro nenhum — deixa a base a parecer bem e com as permissões
-- por pessoa a não serem lidas por política nenhuma.
--
-- Correr no SQL Editor do projeto, colar tudo de uma vez. Dá três tabelas:
--   1. que ficheiros de schema já correram
--   2. quem tem que papel (o que decide se alguém perde acesso no 13.º)
--   3. contagens — tirar ANTES e DEPOIS da migração e comparar
-- ==================================================================


-- ---- 1. Que ficheiros já correram --------------------------------
-- Cada linha procura um objeto que só existe depois desse ficheiro. Um "FALTA"
-- num ficheiro com número menor do que outro que diz "sim" é um alarme: quer
-- dizer que a base foi montada fora de ordem.
with func as (
  select p.proname as nome
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
),
col as (
  select c.relname as tabela, a.attname as coluna
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
)
select * from (
  values
    (1, 'schema.sql',                  'tabela perfil',
        (to_regclass('public.perfil') is not null)),
    (2, 'schema_roles.sql',            'tabela membro_exploracao',
        (to_regclass('public.membro_exploracao') is not null)),
    (3, 'schema_superadmin.sql',       'superadmin_listar_clientes()',
        (exists (select 1 from func where nome = 'superadmin_listar_clientes'))),
    (4, 'schema_seguranca.sql',        'FK animal->exploracao com on delete cascade',
        (exists (
           select 1 from pg_constraint
            where conrelid = to_regclass('public.animal')
              and contype = 'f' and confdeltype = 'c'))),
    (5, 'schema_rgpd.sql',             'apagar_a_minha_conta()',
        (exists (select 1 from func where nome = 'apagar_a_minha_conta'))),
    (6, 'schema_suspensao.sql',        'pode_escrever_em()',
        (exists (select 1 from func where nome = 'pode_escrever_em'))),
    (7, 'schema_versoes.sql',          'trigger trg_updated_at em animal',
        (exists (
           select 1 from pg_trigger
            where tgrelid = to_regclass('public.animal')
              and tgname = 'trg_updated_at'))),
    (8, 'schema_financas.sql',         'tabela movimento',
        (to_regclass('public.movimento') is not null)),
    (9, 'schema_eliminar.sql',         'eliminar_animal()',
        (exists (select 1 from func where nome = 'eliminar_animal'))),
    (10, 'schema_financas_opcional.sql','perfil.financas_ativas',
        (exists (select 1 from col where tabela = 'perfil' and coluna = 'financas_ativas'))),
    (11, 'schema_animal_campos.sql',   'animal.casa',
        (exists (select 1 from col where tabela = 'animal' and coluna = 'casa'))),
    (12, 'schema_notas.sql',           'tabela nota',
        (to_regclass('public.nota') is not null)),
    (13, 'schema_permissoes.sql',      'membro_exploracao.permissoes + pode_cap()',
        (exists (select 1 from col where tabela = 'membro_exploracao' and coluna = 'permissoes')
         and exists (select 1 from func where nome = 'pode_cap'))),
    (14, 'schema_auditoria.sql',       'animal.saida_por + nomes_da_equipa()',
        (exists (select 1 from col where tabela = 'animal' and coluna = 'saida_por')
         and exists (select 1 from func where nome = 'nomes_da_equipa'))),
    (15, 'schema_acesso_temporario.sql','membro_exploracao.expira_em',
        (exists (select 1 from col where tabela = 'membro_exploracao' and coluna = 'expira_em'))),
    -- O 16 não cria nada: só mexe em permissões. A marca é o efeito dele —
    -- nenhuma função `security definer` alcançável por quem não tem sessão.
    (16, 'schema_lint.sql',            'nenhum security definer aberto ao anon',
        (not exists (
           select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef
              and has_function_privilege('anon', p.oid, 'execute'))))
) as t(ordem, ficheiro, marca, aplicado)
order by ordem;
-- Ler a coluna `aplicado`: true = já correu, false = FALTA aplicar.


-- ---- 2. Quem é que fica com que papel ----------------------------
-- O `schema_permissoes.sql` (13.º) reescreve as políticas de ESCRITA: a partir
-- dele, gravar passa por `pode_cap()`, que parte do papel da pessoa. `admin`
-- pode tudo; `trabalhador` e `veterinario` não. Confirmar aqui, ANTES de o
-- aplicar, que quem usa a app a sério está como `admin` na exploração dele —
-- é a diferença entre uma migração invisível e um criador que abre a app no
-- dia seguinte e já não consegue registar nada.
select
  'PAPEL' as tabela,
  u.email,
  e.nome as exploracao,
  m.role,
  (e.user_id = m.user_id) as e_o_dono
from public.membro_exploracao m
join auth.users u on u.id = m.user_id
join public.exploracao e on e.id = m.exploracao_id
order by u.email, e.nome;


-- ---- 3. Contagens (tirar ANTES e DEPOIS) -------------------------
-- Uma migração aditiva não pode mudar nenhum destes números. Se mudarem,
-- parar e restaurar a cópia de segurança.
select 'CONTAGEM' as tabela, 'exploracao' as o_que, count(*) from public.exploracao
union all select 'CONTAGEM', 'terreno', count(*) from public.terreno
union all select 'CONTAGEM', 'animal',  count(*) from public.animal
union all select 'CONTAGEM', 'evento',  count(*) from public.evento
union all select 'CONTAGEM', 'perfil',  count(*) from public.perfil
union all select 'CONTAGEM', 'membro_exploracao', count(*) from public.membro_exploracao;
