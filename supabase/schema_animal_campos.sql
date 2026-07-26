-- ==================================================================
-- Gestão de Gado — casa/número e finalidade do animal (v9)
-- ==================================================================
-- Aplica DEPOIS de schema_financas_opcional.sql. Idempotente.
--
-- PORQUÊ
-- Duas coisas que faltavam à ficha do animal, e que vêm do modo como os
-- criadores portugueses realmente identificam e classificam o gado:
--
--   CASA e NÚMERO ... muitos animais são conhecidos por "a casa e o número"
--                     ("Casa do Monte, 12") — um registo anterior ao brinco e
--                     que ainda hoje se usa a par dele. Sem campo próprio,
--                     isto ia parar ao nome ou às notas e não dava para
--                     filtrar nem ordenar.
--   FINALIDADE ...... para que serve o bovino: leite, criação, semental,
--                     carne, recria, trabalho. Manda no maneio do dia-a-dia
--                     (uma vaca de leite ordenha-se, uma de criação não) e é
--                     dos filtros mais pedidos na lista de animais.
--
-- O INTERRUPTOR DA CASA
-- O registo por casa é comum, mas não universal — dois campos a mais em todos
-- os formulários incomodariam quem nunca o usou. Fica LIGADO PELO CLIENTE,
-- desligado por omissão, no mesmo molde das finanças
-- (`schema_financas_opcional.sql`), com a escolha em `perfil.casa_ativa` e o
-- espelho em `exploracao.casa_ativa` para a equipa a poder ler.
--
-- ATENÇÃO ao que este interruptor NÃO é: ao contrário das finanças, não fecha
-- nenhuma porta no servidor. `casa` e `numero_casa` são colunas de texto sem
-- regra de permissão própria, e continuam graváveis por quem já podia gravar o
-- animal. É uma opção de FORMULÁRIO, para não encher o ecrã a quem não a usa —
-- não é uma medida de segurança, e não deve passar a ser tratada como tal.
-- Desligar esconde os campos por preencher; o que já lá está continua a
-- aparecer na ficha, como em qualquer outro dado do animal.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Colunas novas no animal
-- ------------------------------------------------------------------
alter table public.animal add column if not exists casa text;
alter table public.animal add column if not exists numero_casa text;
alter table public.animal add column if not exists finalidade text;

-- `numero_casa` é texto e não inteiro de propósito: há numerações com letra
-- ("12A") e com zeros à frente ("007"), e um inteiro perdia as duas.

-- A finalidade é escrita pela app a partir de uma lista fechada. A restrição
-- existe para o caso de alguém escrever direto na base — um valor fora da
-- lista não rebentaria nada, mas sumia dos filtros sem explicação.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'animal_finalidade_valida'
  ) then
    alter table public.animal add constraint animal_finalidade_valida
      check (finalidade is null or finalidade in
        ('Leite', 'Criação', 'Semental', 'Carne', 'Recria', 'Trabalho'));
  end if;
end $$;

-- Procurar um animal pela casa é uma das razões de isto existir.
create index if not exists animal_casa_idx on public.animal (exploracao_id, casa);


-- ------------------------------------------------------------------
-- 2. Interruptor do registo por casa
-- ------------------------------------------------------------------
alter table public.perfil
  add column if not exists casa_ativa boolean not null default false;

alter table public.exploracao
  add column if not exists casa_ativa boolean not null default false;


-- ------------------------------------------------------------------
-- 3. RPC: o cliente liga/desliga em toda a conta
-- ------------------------------------------------------------------
-- Mesma forma que `definir_financas_ativas`: perfil + espelho nas explorações
-- que a pessoa administra, numa transação só. Com dois UPDATEs soltos do lado
-- do cliente, uma falha de rede a meio deixava a conta a dizer uma coisa e as
-- explorações outra.
create or replace function public.definir_casa_ativa(ativa boolean)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'é preciso sessão iniciada';
  end if;

  update public.perfil set casa_ativa = ativa where id = auth.uid();

  -- Só as explorações que esta pessoa administra. Um trabalhador que consiga
  -- chamar o RPC muda o seu próprio perfil (inofensivo) e mais nada.
  update public.exploracao e
     set casa_ativa = ativa
   where exists (
     select 1 from public.membro_exploracao m
      where m.exploracao_id = e.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
   );
end;
$$;

grant execute on function public.definir_casa_ativa(boolean) to authenticated;


-- ------------------------------------------------------------------
-- 4. Uma exploração nova herda as duas escolhas do dono
-- ------------------------------------------------------------------
-- Substitui a versão de schema_financas_opcional.sql, mantendo tudo o que ela
-- já fazia (tornar o criador admin e herdar as finanças) e acrescentando a
-- casa. Sem isto, um cliente com o registo por casa ligado criava a exploração
-- seguinte e ela nascia sem os campos, sem explicação nenhuma.
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
-- 5. Avisar a API de que há colunas novas
-- ------------------------------------------------------------------
-- O PostgREST (a API REST do Supabase) trabalha sobre uma cópia em memória da
-- lista de tabelas e colunas. Enquanto essa cópia não se atualizar, gravar um
-- animal falha com "Could not find the 'casa' column of 'animal' in the schema
-- cache" — a coluna já existe, quem ainda não sabe dela é a API. Costuma
-- recarregar sozinha logo a seguir ao DDL, mas não é garantido, e o erro que
-- dá entretanto não se parece nada com a sua causa.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- As colunas existem e estão vazias:
--
--   select count(*) filter (where casa is not null) as com_casa,
--          count(*) filter (where finalidade is not null) as com_finalidade,
--          count(*) as total
--     from public.animal;
--
-- Toda a gente começa com o registo por casa desligado:
--
--   select casa_ativa, count(*) from public.perfil group by 1;
--   select casa_ativa, count(*) from public.exploracao group by 1;
--
-- Ligar na tua conta (ou pelo ecrã Definições → Registo por casa):
--
--   select public.definir_casa_ativa(true);
--   select nome, casa_ativa from public.exploracao order by nome;
--
-- A restrição da finalidade recusa o que não está na lista:
--
--   update public.animal set finalidade = 'Queijo' where id = (select id from public.animal limit 1);
--   -- ERROR:  new row violates check constraint "animal_finalidade_valida"
