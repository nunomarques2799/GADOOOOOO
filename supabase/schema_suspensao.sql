-- ==================================================================
-- Gestão de Gado — suspensão efetiva + veterinário sem eliminar (v5)
-- ==================================================================
-- Aplica DEPOIS de schema.sql + schema_roles.sql + schema_superadmin.sql
-- + schema_seguranca.sql. Idempotente (seguro para correr mais que uma vez).
--
-- O que corrige:
--
--   1. SUSPENSÃO QUE NÃO SUSPENDIA. `superadmin_bloquear_cliente` punha o
--      perfil em 'pendente', mas as políticas de escrita de exploração,
--      terreno, animal e evento só olhavam para `role_em()` — nunca para o
--      estado do perfil. Um cliente que deixasse de pagar mantinha acesso
--      total e permanente a tudo o que já tinha; só ficava impedido de criar
--      explorações NOVAS. Para um produto vendido por subscrição, era a
--      diferença entre suspender e não suspender.
--
--   2. VETERINÁRIO PODIA APAGAR ANIMAIS. `animal_maneio_write` era `for all`,
--      o que inclui DELETE, e incluía o papel `veterinario`. Um veterinário
--      convidado podia apagar o efetivo inteiro — e a FK `evento_animal_fk`
--      em cascata levava o histórico atrás.
--
-- Princípio da suspensão: corta a ESCRITA, nunca a LEITURA. O cliente
-- suspenso continua a ver e a exportar os seus dados (é dele, e o RGPD dá-lhe
-- direito à portabilidade), e `apagar_a_minha_conta()` continua a funcionar
-- por ser SECURITY DEFINER. O que deixa de poder é alterar seja o que for.
-- ==================================================================


-- ------------------------------------------------------------------
-- ANTES DE CORRER: ver quem vai ficar congelado
-- ------------------------------------------------------------------
-- Esta consulta lista as explorações cujo dono NÃO está 'ativo' — são as
-- que ficam só de leitura no instante em que este ficheiro correr. Se
-- aparecer aqui um cliente que devia estar a trabalhar, aprova-o primeiro
-- (`select public.superadmin_aprovar_cliente('<uuid>')`).
--
--   select e.id, e.nome, u.email as dono, p.estado
--     from public.exploracao e
--     join public.membro_exploracao m on m.exploracao_id = e.id and m.role = 'admin'
--     join public.perfil p on p.id = m.user_id
--     join auth.users u on u.id = p.id
--    where p.estado is distinct from 'ativo';


-- ------------------------------------------------------------------
-- 1. Helper: a exploração tem dono ativo?
-- ------------------------------------------------------------------
-- Quem paga é o admin da exploração. Se ele está suspenso, a exploração
-- inteira congela — incluindo os trabalhadores e veterinários que ele
-- convidou. Sem isto, bastaria ao cliente suspenso usar a conta de um
-- trabalhador para continuar a trabalhar de graça.
--
-- Uma exploração sem nenhum admin ativo (órfã) também congela: é o
-- comportamento seguro.
create or replace function public.exploracao_ativa(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1
    from public.membro_exploracao m
    join public.perfil p on p.id = m.user_id
    where m.exploracao_id = exp_id
      and m.role = 'admin'
      and p.estado = 'ativo'
  );
$$;

-- Pode escrever nesta exploração? Exige as duas pontas ativas: quem age e
-- quem paga. `eh_superadmin()` passa sempre, para poder assistir um cliente.
create or replace function public.pode_escrever_em(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select public.eh_superadmin()
      or (public.perfil_ativo() and public.exploracao_ativa(exp_id));
$$;


-- ------------------------------------------------------------------
-- 2. EXPLORAÇÃO — editar e apagar exigem conta ativa
-- ------------------------------------------------------------------
-- A leitura (`exploracao_membros_read`) fica como está: dados à vista.
drop policy if exists exploracao_admin_update on public.exploracao;
create policy exploracao_admin_update on public.exploracao
  for update using (
    public.pode_escrever_em(id) and (public.role_em(id) = 'admin' or public.eh_superadmin())
  ) with check (
    public.pode_escrever_em(id) and (public.role_em(id) = 'admin' or public.eh_superadmin())
  );

drop policy if exists exploracao_admin_delete on public.exploracao;
create policy exploracao_admin_delete on public.exploracao
  for delete using (
    public.pode_escrever_em(id) and (public.role_em(id) = 'admin' or public.eh_superadmin())
  );


-- ------------------------------------------------------------------
-- 3. TERRENO — escrita exige conta ativa
-- ------------------------------------------------------------------
drop policy if exists terreno_maneio_write on public.terreno;
create policy terreno_maneio_write on public.terreno
  for all using (
    public.pode_escrever_em(exploracao_id)
    and (public.role_em(exploracao_id) in ('admin', 'trabalhador') or public.eh_superadmin())
  ) with check (
    public.pode_escrever_em(exploracao_id)
    and (public.role_em(exploracao_id) in ('admin', 'trabalhador') or public.eh_superadmin())
  );


-- ------------------------------------------------------------------
-- 4. ANIMAL — separar escrita de eliminação (o veterinário não elimina)
-- ------------------------------------------------------------------
-- Era uma política `for all` só. Passa a três, para o DELETE poder ter uma
-- lista de papéis mais curta que o INSERT/UPDATE.
drop policy if exists animal_maneio_write on public.animal;
drop policy if exists animal_insere on public.animal;
drop policy if exists animal_atualiza on public.animal;
drop policy if exists animal_elimina on public.animal;

create policy animal_insere on public.animal
  for insert with check (
    public.pode_escrever_em(exploracao_id)
    and (
      public.role_em(exploracao_id) in ('admin', 'trabalhador', 'veterinario')
      or public.eh_superadmin()
    )
  );

create policy animal_atualiza on public.animal
  for update using (
    public.pode_escrever_em(exploracao_id)
    and (
      public.role_em(exploracao_id) in ('admin', 'trabalhador', 'veterinario')
      or public.eh_superadmin()
    )
  ) with check (
    public.pode_escrever_em(exploracao_id)
    and (
      public.role_em(exploracao_id) in ('admin', 'trabalhador', 'veterinario')
      or public.eh_superadmin()
    )
  );

-- Apagar o registo leva o histórico todo atrás (evento_animal_fk em cascata).
-- Fica com quem gere o efetivo. O veterinário regista a morte pela saída
-- (update do animal + evento), que continua a poder fazer.
create policy animal_elimina on public.animal
  for delete using (
    public.pode_escrever_em(exploracao_id)
    and (
      public.role_em(exploracao_id) in ('admin', 'trabalhador')
      or public.eh_superadmin()
    )
  );


-- ------------------------------------------------------------------
-- 5. EVENTO — mesma separação (apagar histórico é o mesmo estrago)
-- ------------------------------------------------------------------
drop policy if exists evento_maneio_write on public.evento;
drop policy if exists evento_insere on public.evento;
drop policy if exists evento_atualiza on public.evento;
drop policy if exists evento_elimina on public.evento;

create policy evento_insere on public.evento
  for insert with check (
    public.eh_superadmin() or exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and public.pode_escrever_em(a.exploracao_id)
        and public.role_em(a.exploracao_id) in ('admin', 'trabalhador', 'veterinario')
    )
  );

create policy evento_atualiza on public.evento
  for update using (
    public.eh_superadmin() or exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and public.pode_escrever_em(a.exploracao_id)
        and public.role_em(a.exploracao_id) in ('admin', 'trabalhador', 'veterinario')
    )
  ) with check (
    public.eh_superadmin() or exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and public.pode_escrever_em(a.exploracao_id)
        and public.role_em(a.exploracao_id) in ('admin', 'trabalhador', 'veterinario')
    )
  );

create policy evento_elimina on public.evento
  for delete using (
    public.eh_superadmin() or exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and public.pode_escrever_em(a.exploracao_id)
        and public.role_em(a.exploracao_id) in ('admin', 'trabalhador')
    )
  );


-- ------------------------------------------------------------------
-- 6. Permissões de execução dos helpers novos
-- ------------------------------------------------------------------
revoke execute on function public.exploracao_ativa(text) from anon, public;
revoke execute on function public.pode_escrever_em(text) from anon, public;
grant  execute on function public.exploracao_ativa(text) to authenticated;
grant  execute on function public.pode_escrever_em(text) to authenticated;


-- ------------------------------------------------------------------
-- DEPOIS DE CORRER: confirmar
-- ------------------------------------------------------------------
-- As políticas de animal devem ser 4 (read + insere + atualiza + elimina),
-- e só `animal_elimina` deve excluir o veterinário:
--
--   select policyname, cmd from pg_policies
--    where tablename in ('animal','evento','terreno','exploracao')
--    order by tablename, cmd, policyname;
--
-- E o helper deve dar `true` para uma exploração de um cliente ativo:
--
--   select e.nome, public.exploracao_ativa(e.id) from public.exploracao e;
