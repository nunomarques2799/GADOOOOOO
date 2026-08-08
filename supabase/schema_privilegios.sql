-- ==================================================================
-- Terrabovina — tirar às sessões os privilégios que elas nunca usam
-- ==================================================================
-- Aplica DEPOIS de tudo o que cria tabelas (é por isso que vem no fim, logo
-- antes do `schema_lint.sql`). Não cria nada nem mexe em políticas: só tira
-- privilégios. Idempotente — pode voltar a correr as vezes que forem precisas.
--
-- O PROBLEMA
--
-- Quando se cria uma tabela num projeto Supabase, os papéis `anon` e
-- `authenticated` recebem por omissão TODOS os privilégios sobre ela. Não é só
-- o `select`/`insert`/`update`/`delete` que a RLS depois filtra linha a linha —
-- vem também `TRUNCATE`, `TRIGGER` e `REFERENCES`, três coisas que esta app
-- nunca pediu a ninguém.
--
-- O `TRUNCATE` é o que interessa: **não passa por RLS nenhuma**. As políticas
-- desta base dizem, linha a linha, que animais é que cada sessão pode ver e
-- escrever; o `truncate` esvazia a tabela INTEIRA sem consultar política
-- alguma. Numa base multi-cliente (`schema_roles.sql`, 2.º), isso é o efetivo
-- de todos os clientes de uma vez.
--
-- PORQUE É QUE ISTO NÃO É UM BURACO ABERTO — E MESMO ASSIM SE FECHA
--
-- Pela API não se lá chega: o PostgREST expõe leituras e escritas de linhas e
-- não tem por onde mandar um `truncate`, e a chave que anda dentro da app
-- (publishable) fala com o PostgREST e mais nada. É privilégio LATENTE: o dia
-- em que exista um caminho que corra SQL escrito por quem tem sessão — uma
-- função nova mal fechada, uma extensão, uma consola de administração — passa a
-- ser buraco, e ninguém se vai lembrar de que ele estava aqui à espera.
--
-- E há a coerência: tirou-se o `delete` do `animal` ao `authenticated` para que
-- eliminar passasse pela função que marca `estado='eliminado'`
-- (`schema_eliminar.sql`, 9.º). Deixar o `truncate` na mesma tabela é fechar a
-- porta e deixar a janela.
--
-- `TRIGGER` e `REFERENCES` saem pela mesma razão, sem drama nenhum: o primeiro
-- deixaria pendurar código próprio nas tabelas da app, o segundo apontar-lhes
-- chaves estrangeiras de fora. Nada nesta app usa nem um nem outro.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. As tabelas que já existem
-- ------------------------------------------------------------------
-- Percorridas por consulta em vez de escritas à mão: uma lista escrita à mão
-- envelhece — ficava parada nas cinco tabelas de julho de 2026 e as sete que
-- nasceram depois (documento, evento_agenda, medicamento, equipa_historico, …)
-- não entravam. E o próximo ficheiro de schema também não avisa ninguém.
--
-- `relkind in ('r','p')`: tabelas e tabelas particionadas. As VISTAS ficam de
-- fora de propósito — `revoke truncate` numa vista é erro de sintaxe, e o lote
-- inteiro caía por causa disso.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
     order by c.relname
  loop
    execute format(
      'revoke truncate, trigger, references on public.%I from anon, authenticated',
      t.relname
    );
  end loop;
end $$;


-- ------------------------------------------------------------------
-- 2. E as que ainda não existem
-- ------------------------------------------------------------------
-- Sem isto, o passo 1 é uma limpeza que dura até ao próximo `create table`: os
-- privilégios por omissão voltam a dar tudo à tabela seguinte, e a base fica
-- outra vez como estava sem que ninguém tenha feito nada de errado.
--
-- É um `revoke` de TRÊS privilégios e não um `revoke all`: as omissões do
-- Supabase são o que dá `select`/`insert`/`update`/`delete` às tabelas novas, e
-- é sobre esses que a RLS trabalha. Levá-los à frente deixava a app a olhar
-- para tabelas onde não conseguia ler nada, com as políticas todas certas e sem
-- uma mensagem que explicasse porquê.
--
-- As omissões pertencem a QUEM CRIA a tabela, por isso não há uma regra global
-- para pôr: repete-se por cada papel que cria schema aqui (o `postgres` da
-- connection string e do SQL Editor, e o `supabase_admin` de dentro da
-- plataforma). Quem não puder mexer nas de outro papel leva um aviso e o
-- ficheiro segue — o passo 1 já correu, e é esse que fecha o que existe hoje.
do $$
declare
  papel text;
begin
  foreach papel in array array['postgres', 'supabase_admin']
  loop
    if exists (select 1 from pg_roles where rolname = papel) then
      begin
        execute format(
          'alter default privileges for role %I in schema public '
          'revoke truncate, trigger, references on tables from anon, authenticated',
          papel
        );
      exception when insufficient_privilege then
        raise notice
          'Sem direitos para mexer nos privilégios por omissão de %. As tabelas '
          'que ESSE papel criar daqui para a frente voltam a nascer com '
          'truncate/trigger/references — voltar a correr este ficheiro depois '
          'de cada schema novo resolve.', papel;
      end;
    end if;
  end loop;
end $$;


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Nenhuma tabela do `public` deixa o `authenticated` esvaziá-la. Tem de vir
--    VAZIO (o `anon` no lugar do `authenticated` também):
--
--   select c.relname
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind in ('r','p')
--      and has_table_privilege('authenticated', c.oid, 'TRUNCATE');
--
-- 2. E o que a app usa continua lá — esta tem de dizer `t` nas quatro:
--
--   select
--     has_table_privilege('authenticated', 'public.animal', 'SELECT') as le,
--     has_table_privilege('authenticated', 'public.animal', 'INSERT') as insere,
--     has_table_privilege('authenticated', 'public.animal', 'UPDATE') as atualiza,
--     has_table_privilege('authenticated', 'public.evento', 'DELETE') as elimina;
--
--   (No `animal` o `delete` está tirado desde o 9.º e é para continuar assim —
--    por isso a pergunta do `delete` é ao `evento`.)
--
-- 3. Uma tabela NOVA já nasce sem eles. Numa base de testes:
--
--   create table public.zz_teste (id int);
--   select has_table_privilege('authenticated', 'public.zz_teste', 'TRUNCATE') as mau,
--          has_table_privilege('authenticated', 'public.zz_teste', 'SELECT')   as bom;
--   drop table public.zz_teste;
--
--   `mau` tem de ser `f` e `bom` tem de ser `t`. Se o `bom` vier `f`, o passo 2
--   levou à frente mais do que devia — parar e repor as omissões:
--   `alter default privileges for role postgres in schema public
--      grant select, insert, update, delete on tables to anon, authenticated;`
