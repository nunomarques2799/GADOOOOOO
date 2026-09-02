-- ==================================================================
-- Prova da RLS das conversas (schema_chat.sql)
-- ==================================================================
-- Corre-se assim, com a ligação da base a provar:
--
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" $url -f supabase\provar_chat.sql
--
-- A impersonar cada papel, e TUDO dentro de uma transação que termina em
-- ROLLBACK: a base fica exatamente como estava.
--
-- OS QUATRO UUID abaixo são as contas da base de DEV. Para correr noutra base,
-- trocá-los pelos de lá:
--
--   select p.id, p.nome, p.is_superadmin from public.perfil p;
--
--
-- As tentativas que TÊM de falhar vão dentro de um bloco que apanha só o erro
-- 42501 (a recusa da RLS) e grita se a escrita passar. Um `\echo` a seguir a um
-- insert não serve: escreve-se na mesma quando o insert corre bem.

\set ON_ERROR_STOP on
\set QUIET on

\set dono   '0e3de665-0d6f-41ac-bbe5-7ac9db214e7a'
\set trab   'db5e297a-41f4-4b49-ad9d-7105709f6653'
\set vet    'f3d7edf1-ffec-4294-94f3-e2619ab85192'
\set super  'bb5af4d7-3e32-4c9a-ab89-426b52334119'
\set exp    'demo-exp-cabeco'

begin;

insert into public.membro_exploracao (user_id, exploracao_id, role)
values (:'trab', :'exp', 'trabalhador'), (:'vet', :'exp', 'veterinario');

\echo ''
\echo '== 1. Quem o gatilho pos no grupo (esperado: dono e trabalhador; o vet NAO) =='
select coalesce(p.nome, '(sem nome)') as pessoa, me.role, (m.saiu_em is null) as no_grupo
  from public.conversa c
  join public.conversa_membro m on m.conversa_id = c.id
  left join public.perfil p on p.id = m.user_id
  left join public.membro_exploracao me on me.user_id = m.user_id and me.exploracao_id = c.exploracao_id
 where c.exploracao_id = :'exp'
 order by me.role;

select id as conv from public.conversa where exploracao_id = :'exp' and tipo = 'grupo' \gset
set local chat.conv = :'conv';
set local chat.vet = :'vet';
set local chat.trab = :'trab';
set local chat.dono = :'dono';

set local role authenticated;
set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
insert into public.mensagem (conversa_id, autor, texto)
values (:'conv', :'dono', 'Amanha as 8 no curral.');

\echo ''
\echo '== 2. O dono le a sua mensagem (esperado: 1) =='
select count(*) as mensagens from public.mensagem;

set local request.jwt.claims = '{"sub":"db5e297a-41f4-4b49-ad9d-7105709f6653","role":"authenticated"}';
\echo ''
\echo '== 3. O trabalhador ve a mensagem do grupo (esperado: 1) =='
select count(*) as mensagens from public.mensagem;

insert into public.mensagem (conversa_id, autor, texto)
values (:'conv', :'trab', 'Combinado.');
\echo '== 4. E consegue escrever (esperado: 2) =='
select count(*) as mensagens from public.mensagem;

set local request.jwt.claims = '{"sub":"f3d7edf1-ffec-4294-94f3-e2619ab85192","role":"authenticated"}';
\echo ''
\echo '== 5. O veterinario NAO ve o grupo (esperado: 0 e 0) =='
select count(*) as conversas_visiveis from public.conversa;
select count(*) as mensagens_visiveis from public.mensagem;

\echo '== 6. Nem consegue escrever la =='
do $$
begin
  insert into public.mensagem (conversa_id, autor, texto)
  values (current_setting('chat.conv')::uuid, current_setting('chat.vet')::uuid, 'entro a martelo');
  raise exception 'FALHA: o veterinario escreveu no grupo da exploracao';
exception when insufficient_privilege then
  raise notice 'OK: a RLS recusou a escrita do veterinario no grupo';
end $$;

set local request.jwt.claims = '{"sub":"bb5af4d7-3e32-4c9a-ab89-426b52334119","role":"authenticated"}';
\echo ''
\echo '== 7. O SUPERADMIN nao le conversa nenhuma (esperado: 0 e 0) =='
select count(*) as conversas_visiveis from public.conversa;
select count(*) as mensagens_visiveis from public.mensagem;

set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
\echo ''
\echo '== 8. Com quem o dono pode falar =='
select u_nome, u_papel from public.pessoas_para_conversar() order by u_papel;

select public.abrir_conversa(:'vet') as privada \gset
set local chat.privada = :'privada';
insert into public.mensagem (conversa_id, autor, texto)
values (:'privada', :'dono', 'Pode vir ver a numero 12?');

set local request.jwt.claims = '{"sub":"f3d7edf1-ffec-4294-94f3-e2619ab85192","role":"authenticated"}';
\echo ''
\echo '== 9. O veterinario ve a privada e continua sem ver o grupo (esperado: 1 e 1) =='
select count(*) as conversas_visiveis from public.conversa;
select count(*) as mensagens_visiveis from public.mensagem;

set local request.jwt.claims = '{"sub":"db5e297a-41f4-4b49-ad9d-7105709f6653","role":"authenticated"}';
\echo ''
\echo '== 10. O trabalhador NAO ve a privada dos outros (esperado: 2 mensagens; as conversas sao 2 porque ele tambem tem a sua) =='
select count(*) as conversas_visiveis from public.conversa;
select count(*) as mensagens_visiveis from public.mensagem;

set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
select public.remover_do_grupo(:'conv', :'trab');
insert into public.mensagem (conversa_id, autor, texto)
values (:'conv', :'dono', 'Isto ele ja nao le.');

set local request.jwt.claims = '{"sub":"db5e297a-41f4-4b49-ad9d-7105709f6653","role":"authenticated"}';
\echo ''
\echo '== 11. Removido do grupo: ve as 2 de antes e NAO a de depois (esperado: 2) =='
select count(*) as mensagens_visiveis from public.mensagem;

\echo '== 12. E nao volta a escrever =='
do $$
begin
  insert into public.mensagem (conversa_id, autor, texto)
  values (current_setting('chat.conv')::uuid, current_setting('chat.trab')::uuid, 'e eu?');
  raise exception 'FALHA: quem foi removido do grupo escreveu nele';
exception when insufficient_privilege then
  raise notice 'OK: a RLS recusou a escrita de quem foi removido';
end $$;

\echo '== 13. Nem se poe de volta a mexer na sua propria linha =='
do $$
begin
  update public.conversa_membro set saiu_em = null, entrou_em = '2000-01-01'
   where conversa_id = current_setting('chat.conv')::uuid
     and user_id = current_setting('chat.trab')::uuid;
  raise exception 'FALHA: mexeu na janela de leitura da sua propria linha';
exception when insufficient_privilege then
  raise notice 'OK: o grant de coluna nao deixou tocar em entrou_em/saiu_em';
end $$;

set local request.jwt.claims = '{"sub":"f3d7edf1-ffec-4294-94f3-e2619ab85192","role":"authenticated"}';
insert into public.bloqueio (bloqueador, bloqueado) values (:'vet', :'dono');

set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
\echo ''
\echo '== 14. Bloqueado pelo veterinario, o dono ja nao lhe escreve =='
do $$
begin
  insert into public.mensagem (conversa_id, autor, texto)
  values (current_setting('chat.privada')::uuid, current_setting('chat.dono')::uuid, 'e agora?');
  raise exception 'FALHA: escreveu para quem o bloqueou';
exception when insufficient_privilege then
  raise notice 'OK: a RLS recusou a mensagem para quem bloqueou';
end $$;

\echo '== 15. E o veterinario sai da lista de quem se pode contactar (esperado: 1) =='
select count(*) as contactaveis from public.pessoas_para_conversar();

reset role;
rollback;
\echo ''
\echo '== FIM. A base ficou como estava (rollback). =='
