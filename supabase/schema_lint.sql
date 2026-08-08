-- ==================================================================
-- Terrabovina — fechar os avisos do linter de segurança do Supabase
-- ==================================================================
-- Aplica DEPOIS de todos os outros (é o último do `ordem.txt`). Idempotente.
--
-- O linter do Supabase (Advisors → Security) dava três famílias de avisos.
-- Este ficheiro fecha o que se fecha por SQL; o que sobra está explicado no
-- fim, porque é intencional e não se deve "corrigir".
--
--   1. `function_search_path_mutable` — 5 funções sem `search_path` fixo.
--      Uma função sem `search_path` resolve os nomes pelo caminho de quem a
--      chama. Quem conseguisse criar um schema seu e pô-lo à frente no
--      `search_path` fazia a função chamar as SUAS tabelas/funções em vez das
--      nossas. Hoje ninguém consegue criar schemas nesta base, por isso o
--      risco é teórico — mas é o tipo de porta que se fecha antes de a base
--      ganhar mais gente, não depois.
--
--   2. `anon_security_definer_function_executable` — 5 funções `security
--      definer` que o papel `anon` (sem sessão iniciada) podia executar por
--      `/rest/v1/rpc/...`. O `schema_seguranca.sql` (4.º) já fazia esta
--      limpeza, mas correu ANTES de estas funções existirem: tudo o que os
--      ficheiros 10, 11 e 14 acrescentaram nasceu com o `EXECUTE` que o
--      Postgres dá ao PUBLIC por omissão. É a razão de a limpeza voltar aqui,
--      no fim da fila.
--
--   3. `authenticated_security_definer_function_executable` — funções `security
--      definer` que um utilizador com sessão pode executar. A maioria é a API
--      da app e fica como está (ver a nota no fim); as que NÃO são para ser
--      chamadas saem daqui.
--
-- O 4.º aviso (`auth_leaked_password_protection`) não é SQL: liga-se no painel,
-- em Authentication → password settings → "Prevent use of leaked passwords".
--
-- O 5.º (`extension_in_public`, sobre o `pg_net`) NÃO se corrige — ver a nota
-- do fim do ficheiro. Em resumo: nada do pg_net está mesmo em `public`, e a
-- extensão não é relocalizável.
-- ==================================================================


-- ------------------------------------------------------------------
-- 0. As funções que NÃO podem ficar ao alcance de quem tem sessão
-- ------------------------------------------------------------------
-- Esta lista existe por causa de um erro que este ficheiro cometia.
--
-- A varredura da secção 2 dá `EXECUTE` a `authenticated` a TODAS as funções
-- `security definer` de `public` que não sejam de trigger. Isso está certo para
-- a API da app e para os ajudantes da RLS — mas apanhava também quatro funções
-- que outros ficheiros tinham FECHADO de propósito, e reabria-as em silêncio na
-- aplicação seguinte. O `schema_notificacao_registo.sql` escreve, na linha 247,
-- `revoke all on function public.enviar_email_notificacao(...) from
-- authenticated` — e este ficheiro, por correr depois, desfazia-o.
--
-- Nenhuma destas é chamada pela app (confirmado por procura em `src/`); todas
-- se chamam à mão, do SQL Editor, onde quem corre é o `postgres` e as
-- permissões de `authenticated` não contam.
--
--   enviar_email_notificacao   manda HTML à escolha de quem chama a partir do
--                              endereço da plataforma. É por causa DELA que o
--                              motor de envio mudou para o schema `interno`
--                              (ver schema_apoio.sql). Tem guarda por dentro
--                              («ou vens de um trigger, ou és superadmin»), mas
--                              uma porta fechada por dentro E por fora é o que
--                              se quer numa função destas.
--   testar_notificacao_registo manda um email de teste. Mesma razão.
--   notificacoes_recentes      o registo de envios: destinos e assuntos.
--   limpar_atividade_antiga    APAGA linhas do registo de atividade. É a
--                              auditoria de quem mexeu em quê.
--
-- O `apagar_a_minha_conta` ESTEVE nesta lista e saiu em 2026-08-07 — a razão
-- está na secção 3.
--
-- Todas verificam `eh_superadmin()` por dentro, portanto isto é a segunda
-- tranca e não a única. Vale a pena na mesma: a primeira depende de cada corpo
-- continuar a fazer a verificação, e esta não depende de nada.
--
-- A lista vive dentro do bloco da secção 2, à frente do `grant` que ela trava.
-- Escrita aqui em cima, numa função ou numa tabela, ficava a um ficheiro de
-- distância da linha que a lê — que é exatamente como o `revoke` do ficheiro 16
-- se perdeu de vista.


-- ------------------------------------------------------------------
-- 1. `search_path` fixo nas funções que ficaram sem ele
-- ------------------------------------------------------------------
-- Nenhuma destas lê tabelas, por isso levam `search_path` VAZIO, que é o mais
-- apertado: obriga a que tudo o que elas usem esteja qualificado (`public.x`)
-- ou seja do `pg_catalog`. As definições de origem já ficaram assim
-- (schema_permissoes.sql, schema_notas.sql, schema_versoes.sql); estes `alter`
-- existem para as bases que já correram as versões antigas.
--
-- Efeito lateral conhecido: uma função SQL com cláusula `SET` deixa de poder
-- ser "inlined" pelo planeador. Estas quatro são chamadas dentro do
-- `pode_cap()`, que já tinha `SET` e já não era inlined — o custo real é uma
-- chamada de função por linha em vez de uma expressão, e a esta escala não se
-- mede.
alter function public.capacidade_gerivel(text)                        set search_path = '';
alter function public.role_padrao_pode(public.role_membro, text)      set search_path = '';
alter function public.ajuste_permissao(jsonb, text)                   set search_path = '';
alter function public.permissoes_membro_validas(jsonb)                set search_path = '';
alter function public.toca_updated_at()                               set search_path = '';


-- ------------------------------------------------------------------
-- 2. Quem pode executar as funções `security definer`
-- ------------------------------------------------------------------
-- Mesma varredura do `schema_seguranca.sql` (3.ª secção), com uma diferença
-- que importa: lá a lista de triggers estava escrita à mão, e por isso ficou
-- desatualizada assim que nasceram triggers novos. Aqui a pergunta é feita ao
-- catálogo — "esta função devolve `trigger`?" — e passa a estar certa sozinha
-- para os triggers que vierem a seguir.
--
--   - `anon` e PUBLIC: nunca. Sem sessão não se chama nada.
--   - funções de trigger: ninguém precisa de `EXECUTE`. Disparam por dentro do
--     `insert`/`update`, e a permissão só é verificada quando o trigger é
--     criado. Expostas em `/rpc/` eram um botão de "corre o meu trigger à mão"
--     sem a linha por trás.
--   - o resto (RPCs da app e ajudantes das políticas de RLS): `authenticated`.
--     Os ajudantes PRECISAM mesmo do `EXECUTE`: uma política de RLS é avaliada
--     com os privilégios de quem faz a consulta, por isso revogar o
--     `pode_cap()` a `authenticated` não fechava nada — partia toda a app com
--     "permission denied for function".
do $$
declare
  r record;
  -- As que ficam fechadas mesmo a quem tem sessão. Ver a secção 0 para o
  -- porquê de cada uma; em duas palavras: mandam emails, apagam auditoria ou
  -- apagam contas, e nenhuma é chamada pela app.
  fechadas constant text[] := array[
    'enviar_email_notificacao',
    'testar_notificacao_registo',
    'notificacoes_recentes',
    'limpar_atividade_antiga'
  ];
begin
  for r in
    select p.proname,
           p.prorettype = 'pg_catalog.trigger'::regtype as e_trigger,
           format('public.%I(%s)', p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from anon, public;', r.sig);
    -- Funções de trigger e as da lista: `authenticated` também não.
    if r.e_trigger or r.proname = any (fechadas) then
      execute format('revoke execute on function %s from authenticated;', r.sig);
    else
      execute format('grant execute on function %s to authenticated;', r.sig);
    end if;
  end loop;
end $$;


-- ------------------------------------------------------------------
-- 3. `apagar_a_minha_conta()` — porque VOLTOU a estar aberta (2026-08-07)
-- ------------------------------------------------------------------
-- Esta função esteve fechada a `authenticated`, e a razão escrita aqui era:
-- «a app NÃO a expõe de propósito» — o botão tinha estado no Perfil, colado ao
-- "Terminar sessão", e um toque a mais apagava a exploração inteira sem volta.
--
-- A app passou a expô-la. Não foi por a decisão antiga ser má: foi porque a
-- App Store obriga quem deixa criar conta a deixar apagá-la de DENTRO da app
-- (diretriz 5.1.1(v)), e uma app que só apaga contas por pedido ao
-- administrador é uma app que a Apple recusa. O acidente que fechou o botão
-- está resolvido do lado da app e não do lado do `grant`: a entrada mudou de
-- cartão, leva a um ecrã só para o assunto (`src/app/conta/apagar.tsx`) que
-- mostra as explorações e os animais que vão cair, e o botão só acorda depois
-- de a pessoa escrever «APAGAR» à mão.
--
-- O `grant` a `authenticated` é o certo para o que ela faz: só apaga QUEM
-- CHAMA (`uid := auth.uid()`, e o `delete` é `where id = uid`). Não há
-- parâmetro nenhum por onde apontar a outra conta, e por isso ter `EXECUTE`
-- não dá a ninguém nada que essa pessoa já não pudesse fazer a si própria.
-- Fechá-la também nunca protegeu grande coisa: quem tivesse o token da sessão
-- chamava-a à mesma em `/rest/v1/rpc/` — é o que dizia a nota anterior.
--
-- O que se perde, e é bom estar escrito: NÃO há segunda autenticação. Um
-- telemóvel desbloqueado com a sessão aberta apaga a conta sem pedir a
-- palavra-passe. Aceita-se porque o mesmo telemóvel já dava para apagar os
-- animais um a um, e porque pedir a palavra-passe a criadores idosos num ecrã
-- destes trocava um risco por outro. Se um dia deixar de se aceitar, o sítio
-- de o corrigir é o ecrã da app, não este ficheiro.
--
-- Se o botão sair outra vez da app, o nome volta à lista da secção 2 — e a
-- marca 33 do `estado.sql` volta a ter de mudar com ele.


-- ==================================================================
-- O QUE FICA A AVISAR — E PORQUÊ SE DEIXA ASSIM
-- ==================================================================
-- Depois disto, o linter continua a listar ~25 funções em
-- `authenticated_security_definer_function_executable`. Não é lixo por
-- limpar: é a API da app.
--
--   - RPCs que a app chama mesmo (`eliminar_animal`, `criar_convite`,
--     `resgatar_convite`, `definir_casa_ativa`, `definir_financas_ativas`,
--     `nomes_da_equipa`, `superadmin_*`). Todas validam quem chama à cabeça —
--     `eh_superadmin()`, `pode_cap()`, `role_em() = 'admin'`. São `security
--     definer` precisamente para poderem verificar mais do que a RLS verifica.
--   - Ajudantes das políticas de RLS (`membro_de`, `role_em`, `pode_cap`,
--     `pode_escrever_em`, `exploracao_ativa`, `perfil_ativo`, `eh_superadmin`,
--     `financas_ativas_em`). Sem `EXECUTE` a `authenticated`, as políticas que
--     os chamam rebentam. Respondem todos sobre o `auth.uid()` de quem
--     pergunta, por isso estarem em `/rpc/` não revela nada de ninguém.
--
-- A outra saída que o linter sugere — mudá-los para um schema fora da API —
-- obrigava a reescrever TODAS as políticas de RLS em produção, para fechar uma
-- exposição que não conta nada a quem a chama. Não compensa.
--
-- ------------------------------------------------------------------
-- E o `extension_in_public` do `pg_net`: também fica, e não é preguiça
-- ------------------------------------------------------------------
-- O aviso diz «Extension `pg_net` is installed in the public schema. Move it to
-- another schema». Duas coisas, medidas na base de produção a 2026-08-01:
--
--   1. NADA do pg_net está em `public`. Os 15 objetos com nome dele — o
--      `http_post`, a fila, o `_http_response` — vivem todos no schema `net`.
--      O que está em `public` é só o REGISTO da extensão
--      (`pg_extension.extnamespace`). O PostgREST expõe `public`, não expõe o
--      `net`, portanto não há nada alcançável por `/rest/v1/` que este aviso
--      esteja a apontar.
--
--        select n.nspname, count(*) from pg_depend d
--          left join pg_proc p on p.oid = d.objid
--          left join pg_namespace n on n.oid = p.pronamespace
--         where d.refobjid = (select oid from pg_extension where extname='pg_net')
--         group by 1;
--
--   2. `pg_net` NÃO é relocalizável (`extrelocatable = f`), portanto o
--      `alter extension ... set schema` recusa. A única maneira de o mover é
--      `drop extension ... cascade` + `create extension`, e isso leva atrás o
--      schema `net` inteiro: a fila de pedidos por enviar e o histórico de
--      respostas que o `notificacoes_recentes()` lê para dizer se um email
--      chegou.
--
-- Trocar o diagnóstico dos emails, e arriscar apanhar a fila a meio de um
-- envio, para calar um aviso que aponta para um schema onde não está nada —
-- não. Se um dia o Supabase tornar o pg_net relocalizável, é uma linha.
--
-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- 1. Nenhuma função `security definer` alcançável sem sessão (0 linhas):
--
--   select p.proname
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosecdef
--      and has_function_privilege('anon', p.oid, 'execute');
--
-- 2. Nenhuma função de trigger alcançável por quem tem sessão (0 linhas):
--
--   select p.proname
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosecdef
--      and p.prorettype = 'pg_catalog.trigger'::regtype
--      and has_function_privilege('authenticated', p.oid, 'execute');
--
-- 3. As cinco funções da secção 1 ficaram com `search_path` (5 linhas):
--
--   select proname, proconfig from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and proname in ('capacidade_gerivel','role_padrao_pode',
--                      'ajuste_permissao','permissoes_membro_validas',
--                      'toca_updated_at');
--
-- 4. As quatro da lista ficaram fechadas a quem tem sessão — e a quinta, que
--    saiu da lista em 2026-08-07, ficou ABERTA. São 5 linhas: as quatro
--    primeiras a `f` e o `apagar_a_minha_conta` a `t`.
--
--    Vale a pena pedir as cinco e não as quatro: é este `t` que prova que o
--    ficheiro que correu é a versão nova. Com a versão anterior o botão de
--    apagar a conta rebenta na app com «permission denied for function», que
--    é um erro que não se descobre a ler SQL nenhum.
--
--   select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as aberta
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('enviar_email_notificacao','testar_notificacao_registo',
--                        'notificacoes_recentes','limpar_atividade_antiga',
--                        'apagar_a_minha_conta');
--
-- 5. E o aviso de registo novo CONTINUA a sair — é o que prova que fechar o
--    `enviar_email_notificacao` a `authenticated` não partiu o trigger, que a
--    chama por dentro e não precisa de `EXECUTE` de ninguém:
--
--   select public.testar_notificacao_registo();     -- no SQL Editor (postgres)
--   select * from public.notificacoes_recentes();   -- estado do envio
--
-- 6. E a app continua a andar: entrar, abrir o efetivo, gravar um animal,
--    abrir a aba Trabalhadores. É a secção 2 que se está a provar — um
--    `EXECUTE` a menos num ajudante de RLS aparece como "permission denied
--    for function" na primeira leitura.
