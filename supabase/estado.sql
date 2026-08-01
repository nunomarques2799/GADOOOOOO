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
--
-- AO ACRESCENTAR UM FICHEIRO AO `ordem.txt`, ACRESCENTA UMA LINHA AQUI. Esta
-- lista ficou parada nos 15 enquanto o `ordem.txt` ia em 20, e como o número
-- do fim era o do `schema_lint.sql`, a tabela parecia inteira: 16 linhas todas
-- a `t` numa base a que faltavam CINCO ficheiros. Uma lista curta não se
-- queixa — responde "tudo aplicado" sobre o que não chegou a perguntar.
--
-- E a marca tem de ser um objeto que SÓ aquele ficheiro cria. Se o objeto já
-- vinha de trás (uma função reescrita, uma limpeza repetida), a marca dá `t`
-- sem o ficheiro ter corrido — ver o 20 e o 21 aqui abaixo.
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
    (16, 'schema_notificacao_registo.sql','tabela notificacao_envio',
        (to_regclass('public.notificacao_envio') is not null)),
    (17, 'schema_acesso_ate.sql',      'convite.acesso_ate',
        (exists (select 1 from col where tabela = 'convite' and coluna = 'acesso_ate'))),
    (18, 'schema_atividade.sql',       'tabela registo_atividade',
        (to_regclass('public.registo_atividade') is not null)),
    -- O 19 move o motor de envio de `public` para o schema `interno` — daí a
    -- procura ser fora do `public`, que é o único que a CTE `func` cobre.
    (19, 'schema_apoio.sql',           'interno.enviar_email()',
        (exists (
           select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'interno' and p.proname = 'enviar_email'))),
    -- O 20 não cria objetos: reescreve o `role_padrao_pode()` que já vinha do
    -- 13.º. A marca tem de olhar para DENTRO da função, senão dava `t` no 13.
    (20, 'schema_papel_veterinario.sql','role_padrao_pode() já sabe registarTratamentos',
        (exists (
           select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'role_padrao_pode'
              and pg_get_functiondef(p.oid) like '%registarTratamentos%'))),
    (21, 'schema_fotos_localizacao.sql','terreno.fotografia + exploracao.latitude',
        (exists (select 1 from col where tabela = 'terreno' and coluna = 'fotografia')
         and exists (select 1 from col where tabela = 'exploracao' and coluna = 'latitude'))),
    (22, 'schema_convite_por_papel.sql','intencao_de_equipa() existe',
        (exists (select 1 from func where nome = 'intencao_de_equipa'))),
    (23, 'schema_agenda.sql',          'tabela evento_agenda',
        (to_regclass('public.evento_agenda') is not null)),
    -- Duas marcas porque este ficheiro escreve em dois sítios que se aplicam
    -- separadamente: a tabela (base) e o bucket (Storage). Uma base com a
    -- tabela e sem o bucket lista documentos que não abrem.
    (24, 'schema_documentos.sql',      'tabela documento + bucket documentos',
        (to_regclass('public.documento') is not null
         and exists (select 1 from storage.buckets where id = 'documentos'))),
    -- O último não cria nada: só mexe em permissões. A marca é o efeito dele. São
    -- DUAS condições porque a primeira, sozinha, mente: a limpeza do anon já
    -- tinha sido feita pelo `schema_seguranca.sql` (4.º), por isso uma base a
    -- que faltava este ficheiro inteiro dava `t` na passagem a produção de
    -- 2026-07-31. A segunda só ele a produz — o 5.º dá o `execute` de
    -- `apagar_a_minha_conta()` a `authenticated` e mais nenhum o tira.
    (25, 'schema_lint.sql',            'nenhum security definer ao anon + apagar_a_minha_conta() fechada',
        (not exists (
           select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef
              and has_function_privilege('anon', p.oid, 'execute'))
         and exists (
           select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'apagar_a_minha_conta'
              and not has_function_privilege('authenticated', p.oid, 'execute'))))
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
