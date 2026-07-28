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
-- ==================================================================


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
begin
  for r in
    select p.prorettype = 'pg_catalog.trigger'::regtype as e_trigger,
           format('public.%I(%s)', p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from anon, public;', r.sig);
    if r.e_trigger then
      execute format('revoke execute on function %s from authenticated;', r.sig);
    else
      execute format('grant execute on function %s to authenticated;', r.sig);
    end if;
  end loop;
end $$;


-- ------------------------------------------------------------------
-- 3. `apagar_a_minha_conta()` deixa de estar ao alcance da API
-- ------------------------------------------------------------------
-- A app NÃO expõe esta função — a decisão está escrita em `src/data/auth.tsx`:
-- o botão existiu no Perfil, colado ao "Terminar sessão", e um toque a mais
-- apagava a exploração inteira sem volta. O pedido de apagamento passa pelo
-- administrador.
--
-- Só que a app não a expor não a torna inalcançável: qualquer pessoa com o
-- token da sua sessão a podia chamar diretamente em `/rest/v1/rpc/`. Tirar o
-- `EXECUTE` põe a permissão de acordo com a decisão de produto.
--
-- O direito ao apagamento (RGPD) continua garantido: apagar o utilizador em
-- Authentication → Users faz cair tudo por cascata das foreign keys do
-- `schema_seguranca.sql`, que é exatamente o que a função fazia.
--
-- Se o botão voltar à app, esta linha tem de ser trocada por um `grant`.
revoke execute on function public.apagar_a_minha_conta() from anon, public, authenticated;


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
-- 4. E a app continua a andar: entrar, abrir o efetivo, gravar um animal,
--    abrir a aba Trabalhadores. É a secção 2 que se está a provar — um
--    `EXECUTE` a menos num ajudante de RLS aparece como "permission denied
--    for function" na primeira leitura.
