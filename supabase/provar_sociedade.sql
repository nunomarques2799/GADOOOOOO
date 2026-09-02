-- ==================================================================
-- Prova do schema_sociedade.sql — impersonar cada papel, com rollback
-- ==================================================================
-- Ver a memória `gado-provar-rls-psql`: os ids apanham-se ANTES de assumir a
-- sessão (`\gset`), e um teste negativo tem de ACUSAR quando não falha — daí o
-- `raise exception 'FALHOU A PROVA'` a seguir a cada escrita que devia ser
-- recusada.
--
-- Cobaias: `claude@gmail.com` faz de sociedade, `veterinario@gmail.com` faz de
-- líder (nenhum é superadmin, e o superadmin passaria em tudo).
\set ON_ERROR_STOP on

select id::text as uid_soc   from auth.users where email = 'claude@gmail.com' \gset
select id::text as uid_lider from auth.users where email = 'veterinario@gmail.com' \gset

begin;

-- ------------------------------------------------------------------
-- 1. A conta passa a sociedade e cria uma exploração
-- ------------------------------------------------------------------
update public.perfil set tipo_conta = 'sociedade' where id = :'uid_soc';

insert into public.exploracao (id, user_id, nome, marca_exploracao, nif_detentor)
values ('prova-soc', :'uid_soc', 'Prova Sociedade', 'PT 99 999 9999', '999999999');

select case
         when (select role::text from public.membro_exploracao
                where exploracao_id = 'prova-soc' and user_id = :'uid_soc') = 'supervisor'
           then 'OK  1. a exploração nasceu com supervisor'
         else 'FALHOU 1'
       end as resultado;

-- ------------------------------------------------------------------
-- 2. Na sessão do SUPERVISOR
-- ------------------------------------------------------------------
select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_soc', 'role', 'authenticated')::text, true);
set local role authenticated;

-- Terreno: tem de FUNCIONAR.
insert into public.terreno (id, exploracao_id, nome)
values ('prova-ter', 'prova-soc', 'Courela da Prova');
select 'OK  2a. supervisor criou terreno' as resultado;

-- Editar a exploração: tem de afetar 1 linha.
update public.exploracao set nome = 'Prova Sociedade II' where id = 'prova-soc';
select case when (select nome from public.exploracao where id = 'prova-soc') = 'Prova Sociedade II'
            then 'OK  2b. supervisor editou a exploração' else 'FALHOU 2b' end as resultado;

-- Animal: tem de ser RECUSADO.
do $$ begin
  begin
    insert into public.animal (id, exploracao_id, nome, especie, sexo, data_nascimento)
    values ('prova-ani', 'prova-soc', 'Malhada', 'bovino', 'femea', '2024-01-01');
    raise exception 'FALHOU 2c: o supervisor registou um animal';
  exception when insufficient_privilege then
    raise notice 'OK  2c. animal recusado ao supervisor';
  end;
end $$;

-- Evento na agenda: tem de ser RECUSADO.
do $$ begin
  begin
    insert into public.evento_agenda (exploracao_id, titulo, dia, criado_por, publico)
    values ('prova-soc', 'Feira', current_date, (current_setting('request.jwt.claims')::json->>'sub')::uuid, true);
    raise exception 'FALHOU 2d: o supervisor marcou na agenda';
  exception when insufficient_privilege then
    raise notice 'OK  2d. agenda recusada ao supervisor';
  end;
end $$;

reset role;

-- ------------------------------------------------------------------
-- 3. Entra o LÍDER (como se tivesse resgatado um código de admin)
-- ------------------------------------------------------------------
insert into public.membro_exploracao (user_id, exploracao_id, role)
values (:'uid_lider', 'prova-soc', 'admin');

select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_lider', 'role', 'authenticated')::text, true);
set local role authenticated;

-- Registar um animal: tem de FUNCIONAR (é ele que trata do gado).
insert into public.animal (id, exploracao_id, nome, especie, sexo, data_nascimento)
values ('prova-ani', 'prova-soc', 'Malhada', 'bovino', 'femea', '2024-01-01');
select 'OK  3a. líder registou um animal' as resultado;

-- Apagar a linha do supervisor: tem de apagar 0 linhas.
delete from public.membro_exploracao where exploracao_id = 'prova-soc' and role::text = 'supervisor';
select case when (select count(*) from public.membro_exploracao
                   where exploracao_id = 'prova-soc' and role::text = 'supervisor') = 1
            then 'OK  3b. líder não apagou o supervisor' else 'FALHOU 3b' end as resultado;

-- Apagar a exploração: tem de apagar 0 linhas.
delete from public.exploracao where id = 'prova-soc';
select case when exists (select 1 from public.exploracao where id = 'prova-soc')
            then 'OK  3c. líder não apagou a exploração' else 'FALHOU 3c' end as resultado;

-- Criar exploração própria: tem de ser RECUSADO (é convidado, nunca criou nenhuma).
do $$ begin
  begin
    insert into public.exploracao (id, user_id, nome, marca_exploracao, nif_detentor)
    values ('prova-lider', (current_setting('request.jwt.claims')::json->>'sub')::uuid,
            'Quinta do Líder', 'PT 88 888 8888', '888888888');
    raise exception 'FALHOU 3d: o líder abriu quinta própria';
  exception when insufficient_privilege then
    raise notice 'OK  3d. líder não abre quinta própria';
  end;
end $$;

reset role;

-- ------------------------------------------------------------------
-- 4. A suspensão segue a SOCIEDADE, e não o líder
-- ------------------------------------------------------------------
update public.perfil set estado = 'pendente' where id = :'uid_soc';

select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_lider', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$ begin
  begin
    insert into public.animal (id, exploracao_id, nome, especie, sexo, data_nascimento)
    values ('prova-ani2', 'prova-soc', 'Ruça', 'bovino', 'femea', '2024-02-01');
    raise exception 'FALHOU 4: o líder escreveu com a sociedade suspensa';
  exception when insufficient_privilege then
    raise notice 'OK  4.  sociedade suspensa congela o líder';
  end;
end $$;

reset role;
update public.perfil set estado = 'ativo' where id = :'uid_soc';

-- ------------------------------------------------------------------
-- 5. O SUPERVISOR apaga a exploração dele
-- ------------------------------------------------------------------
select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_soc', 'role', 'authenticated')::text, true);
set local role authenticated;

delete from public.exploracao where id = 'prova-soc';
select case when not exists (select 1 from public.exploracao where id = 'prova-soc')
            then 'OK  5.  supervisor apagou a exploração dele' else 'FALHOU 5' end as resultado;

reset role;

-- ------------------------------------------------------------------
-- 6. E o DONO DE SEMPRE não perdeu nada
-- ------------------------------------------------------------------
-- Uma exploração sem supervisor: o `admin` continua a apagar a sua.
update public.perfil set tipo_conta = 'individual' where id = :'uid_soc';

insert into public.exploracao (id, user_id, nome, marca_exploracao, nif_detentor)
values ('prova-ind', :'uid_soc', 'Prova Individual', 'PT 77 777 7777', '777777777');

select case
         when (select role::text from public.membro_exploracao
                where exploracao_id = 'prova-ind' and user_id = :'uid_soc') = 'admin'
           then 'OK  6a. conta individual continua a nascer admin'
         else 'FALHOU 6a'
       end as resultado;

select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_soc', 'role', 'authenticated')::text, true);
set local role authenticated;

delete from public.exploracao where id = 'prova-ind';
select case when not exists (select 1 from public.exploracao where id = 'prova-ind')
            then 'OK  6b. dono de sempre apaga a sua exploração' else 'FALHOU 6b' end as resultado;

-- CONTROLO POSITIVO, e não é zelo a mais: um gatilho que recuse a linha INTEIRA
-- em vez das três colunas partia cada gravação do perfil, e o teste negativo
-- abaixo passava na mesma. Escrever o nome tem de continuar a funcionar.
update public.perfil set nome = 'Prova do Nome'
 where id = (current_setting('request.jwt.claims')::json->>'sub')::uuid;
select case when (select nome from public.perfil
                   where id = (current_setting('request.jwt.claims')::json->>'sub')::uuid)
                 = 'Prova do Nome'
            then 'OK  6c. gravar o nome do perfil continua a funcionar' else 'FALHOU 6c' end
       as resultado;

-- O guarda das colunas reservadas: uma sessão não se promove a si própria.
do $$ begin
  begin
    update public.perfil set is_superadmin = true
     where id = (current_setting('request.jwt.claims')::json->>'sub')::uuid;
    raise exception 'FALHOU 6d: a sessão promoveu-se a superadmin';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice 'OK  6d. is_superadmin recusado (%)', sqlerrm;
  when insufficient_privilege then
    raise notice 'OK  6d. is_superadmin recusado por grant';
  end;
end $$;

-- E o mesmo para o tipo de conta: uma conta não se faz sociedade a si própria.
do $$ begin
  begin
    update public.perfil set tipo_conta = 'sociedade'
     where id = (current_setting('request.jwt.claims')::json->>'sub')::uuid;
    raise exception 'FALHOU 6e: a sessão marcou-se como sociedade';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice 'OK  6e. tipo_conta recusado (%)', sqlerrm;
  when insufficient_privilege then
    raise notice 'OK  6e. tipo_conta recusado por grant';
  end;
end $$;

reset role;

rollback;

-- Depois do rollback, nada disto ficou.
select count(*) as sobras from public.exploracao where id in ('prova-soc', 'prova-ind', 'prova-lider');
