-- ==================================================================
-- Terrabovina — as existências passam a ser opcionais
-- ==================================================================
-- Aplica DEPOIS de schema_medicamentos.sql. Idempotente.
--
-- PORQUÊ
-- Pela mesma razão das finanças (ver `schema_financas_opcional.sql`): nem todo
-- o criador quer o registo de medicamentos dentro desta app. Quem tem meia
-- dúzia de cabeças e leva o frasco do veterinário não tem arrecadação nenhuma
-- para gerir, e um separador "Existências" permanentemente vazio não é uma
-- funcionalidade — é uma pergunta por responder no meio da barra de baixo.
--
-- Desligar ESCONDE, NÃO APAGA. Nenhuma linha de `medicamento` é removida aqui,
-- e nenhum `evento.medicamento_id`/`quantidade` já gravado é limpo: quem
-- religar encontra a arrecadação como a deixou, e o que resta de cada lote
-- continua a ser a mesma conta (comprado − aplicado), porque essa conta nunca
-- esteve guardada em coluna nenhuma.
--
-- ONDE VIVE O INTERRUPTOR (e porque é que são duas colunas)
--   `perfil.existencias_ativas` ...... a escolha do cliente. É o que ele liga.
--   `exploracao.existencias_ativas` .. espelho, mantido pelo RPC abaixo.
--
-- Duas colunas pela mesma razão das finanças: a RLS de `perfil` só deixa cada
-- um ver o SEU perfil, e o trabalhador precisa de saber se as existências estão
-- ligadas na exploração ONDE TRABALHA — não no perfil do patrão, que ele não lê.
--
-- O DEFAULT NÃO É `false`, ao contrário das finanças, e é de propósito.
-- As finanças nasceram desligadas porque nasceram com o interruptor: ninguém
-- perdia nada. As existências já cá andam e já têm gente a usá-las — pôr toda a
-- gente a `false` fazia desaparecer da app de um criador, sem aviso, o registo
-- de medicamentos que a lei o obriga a ter. Por isso o passo 5 liga-as a quem
-- JÁ TEM lotes registados. Quem nunca deu entrada de nenhum nasce desligado,
-- que é o comportamento que se pediu.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Colunas
-- ------------------------------------------------------------------
alter table public.perfil
  add column if not exists existencias_ativas boolean not null default false;

alter table public.exploracao
  add column if not exists existencias_ativas boolean not null default false;


-- ------------------------------------------------------------------
-- 2. Helper: as existências estão ligadas nesta exploração?
-- ------------------------------------------------------------------
-- SECURITY DEFINER como os restantes helpers, para poder ser usado dentro de
-- policies sem recursão de RLS.
create or replace function public.existencias_ativas_em(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select coalesce(
    (select existencias_ativas from public.exploracao where id = exp_id),
    false
  );
$$;


-- ------------------------------------------------------------------
-- 3. RPC: o cliente liga/desliga, de uma vez, em toda a conta
-- ------------------------------------------------------------------
create or replace function public.definir_existencias_ativas(ativas boolean)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'é preciso sessão iniciada';
  end if;

  update public.perfil set existencias_ativas = ativas where id = auth.uid();

  -- Só as explorações que esta pessoa administra. Um trabalhador que consiga
  -- chamar o RPC muda o seu próprio perfil (inofensivo) e mais nada.
  update public.exploracao e
     set existencias_ativas = ativas
   where exists (
     select 1 from public.membro_exploracao m
      where m.exploracao_id = e.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
   );
end;
$$;


-- ------------------------------------------------------------------
-- 4. Uma exploração nova herda as TRÊS escolhas do dono
-- ------------------------------------------------------------------
-- Substitui a versão de `schema_animal_campos.sql`, mantendo tudo o que ela já
-- fazia (tornar o criador admin, herdar as finanças e a casa) e acrescentando
-- as existências. Sem isto, um cliente com a arrecadação ligada criava a
-- exploração seguinte e ela nascia sem ela, sem explicação nenhuma.
create or replace function public.handle_new_exploracao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.membro_exploracao (user_id, exploracao_id, role)
  values (new.user_id, new.id, 'admin')
  on conflict do nothing;

  update public.exploracao
     set financas_ativas = coalesce(
           (select p.financas_ativas from public.perfil p where p.id = new.user_id),
           false
         ),
         casa_ativa = coalesce(
           (select p.casa_ativa from public.perfil p where p.id = new.user_id),
           false
         ),
         existencias_ativas = coalesce(
           (select p.existencias_ativas from public.perfil p where p.id = new.user_id),
           false
         )
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_exploracao_created on public.exploracao;
create trigger on_exploracao_created
  after insert on public.exploracao
  for each row execute function public.handle_new_exploracao();


-- ------------------------------------------------------------------
-- 5. Quem já usa a arrecadação não a perde
-- ------------------------------------------------------------------
-- Ver a nota do cabeçalho. Só corre onde há lotes registados, e só liga (nunca
-- desliga), por isso pode voltar a correr sem desfazer uma escolha que o
-- criador tenha feito entretanto.
update public.exploracao e
   set existencias_ativas = true
 where not e.existencias_ativas
   and exists (select 1 from public.medicamento m where m.exploracao_id = e.id);

-- E o perfil de quem administra essas explorações, para o interruptor no ecrã
-- aparecer ligado (é o perfil que ele lê) e para a exploração seguinte nascer
-- ligada também.
update public.perfil p
   set existencias_ativas = true
 where not p.existencias_ativas
   and exists (
     select 1
       from public.membro_exploracao m
       join public.exploracao e on e.id = m.exploracao_id
      where m.user_id = p.id
        and m.role = 'admin'
        and e.existencias_ativas
   );


-- ------------------------------------------------------------------
-- 6. Permissões das funções
-- ------------------------------------------------------------------
-- Feitas AQUI, e não deixadas ao `schema_lint.sql`, porque este ficheiro corre
-- DEPOIS dele na ordem: uma função criada a seguir ao lint nasce com o
-- `EXECUTE` que o Postgres dá a `PUBLIC` por omissão, que é exatamente o que o
-- lint existe para tirar. Assim o ficheiro fecha-se a si mesmo e não fica a
-- depender de alguém se lembrar de correr o lint outra vez.
--
-- E é `from anon, public` e não só `from public`, porque são DUAS origens
-- diferentes e tirar uma não tira a outra. Além do `EXECUTE` que o Postgres dá
-- a `PUBLIC`, o Supabase tem `alter default privileges ... grant execute on
-- functions to anon, authenticated, service_role`, que põe o `anon` na ACL da
-- função por NOME. Revogar de `PUBLIC` deixa essa linha intacta: a 2026-08-08 o
-- ficheiro corrido em dev deixou `existencias_ativas_em` e
-- `definir_existencias_ativas` com `anon=X`, e foi a marca do `schema_lint.sql`
-- no `estado.sql` que deu por isso. É o mesmo `revoke ... from anon, public`
-- que a secção 5 do `schema_lint.sql` faz a todas as outras.
--
-- Importa porque `existencias_ativas_em` é SECURITY DEFINER e lê a `exploracao`
-- por fora da RLS: aberta ao `anon`, dizia a quem tivesse a chave anónima (que
-- vai dentro da app, é pública) se uma dada exploração tem as existências
-- ligadas, sem sessão nenhuma.
revoke execute on function public.definir_existencias_ativas(boolean) from anon, public;
revoke execute on function public.existencias_ativas_em(text) from anon, public;
revoke execute on function public.handle_new_exploracao() from anon, public;

grant execute on function public.definir_existencias_ativas(boolean) to authenticated;
-- O helper é chamado de dentro de policies, que correm no papel de quem
-- consulta: sem isto, uma policy que o use rebenta com "permission denied".
grant execute on function public.existencias_ativas_em(text) to authenticated;


-- ------------------------------------------------------------------
-- 7. A API tem de reler o schema
-- ------------------------------------------------------------------
-- Sem isto, a app recebe `Could not find the 'existencias_ativas' column of
-- 'exploracao' in the schema cache` — o erro diz "não existe", a coluna existe,
-- e não há nada no SQL que sugira onde procurar.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- Conferir
-- ------------------------------------------------------------------
--   select nome, existencias_ativas from public.exploracao order by nome;
--   select existencias_ativas, count(*) from public.perfil group by 1;
--
-- E ligar/desligar como cliente (não como service_role):
--   select public.definir_existencias_ativas(true);
