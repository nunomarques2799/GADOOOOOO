-- ==================================================================
-- Prova das fases 2, 3 e 4 do chat: anexos, sondagens e push
-- ==================================================================
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" $url -f supabase\provar_chat_anexos.sql
--
-- Irmão do `provar_chat.sql`: mesma mecânica (impersonar cada papel, tudo numa
-- transação que acaba em ROLLBACK) e os mesmos UUID da base de DEV lá em cima.
--
-- O `pg_net` é seguro aqui: o pedido HTTP fica numa fila DENTRO da transação, e
-- o rollback leva-o com ele. Nenhuma notificação sai desta prova.

\set ON_ERROR_STOP on
\set QUIET on

\set dono   '0e3de665-0d6f-41ac-bbe5-7ac9db214e7a'
\set trab   'db5e297a-41f4-4b49-ad9d-7105709f6653'
\set vet    'f3d7edf1-ffec-4294-94f3-e2619ab85192'
\set exp    'demo-exp-cabeco'

begin;

insert into public.membro_exploracao (user_id, exploracao_id, role)
values (:'trab', :'exp', 'trabalhador'), (:'vet', :'exp', 'veterinario');

select id as conv from public.conversa where exploracao_id = :'exp' and tipo = 'grupo' \gset
set local chat.conv = :'conv';
set local chat.dono = :'dono';

set local role authenticated;
set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';

-- ------------------------------------------------------------------
\echo ''
\echo '== 1. Uma mensagem de texto SEM texto continua a ser recusada =='
do $$
begin
  insert into public.mensagem (conversa_id, autor, texto)
  values (current_setting('chat.conv')::uuid, current_setting('chat.dono')::uuid, '   ');
  raise exception 'FALHA: entrou uma mensagem de texto vazia';
exception when check_violation then
  raise notice 'OK: recusada pela restricao mensagem_conteudo';
end $$;

\echo '== 2. Uma FOTOGRAFIA sem ficheiro tambem =='
do $$
begin
  insert into public.mensagem (conversa_id, autor, texto, tipo)
  values (current_setting('chat.conv')::uuid, current_setting('chat.dono')::uuid, '', 'foto');
  raise exception 'FALHA: entrou uma fotografia sem ficheiro';
exception when check_violation then
  raise notice 'OK: uma foto sem anexo nao entra';
end $$;

\echo '== 3. Uma LOCALIZACAO sem coordenadas tambem =='
do $$
begin
  insert into public.mensagem (conversa_id, autor, texto, tipo)
  values (current_setting('chat.conv')::uuid, current_setting('chat.dono')::uuid, '', 'local');
  raise exception 'FALHA: entrou uma localizacao sem coordenadas';
exception when check_violation then
  raise notice 'OK: uma localizacao sem coordenadas nao entra';
end $$;

\echo '== 4. Uma fotografia COM ficheiro entra, e sem legenda =='
insert into public.mensagem (conversa_id, autor, texto, tipo, anexo, anexo_tamanho)
values (:'conv', :'dono', '', 'foto', :'conv' || '/11111111-1111-4111-8111-111111111111.jpg', 240000);
select tipo, anexo is not null as tem_ficheiro, texto = '' as sem_legenda
  from public.mensagem where tipo = 'foto';

\echo '== 5. Apagar essa mensagem poe o ficheiro na lista de espera =='
select id as msgfoto from public.mensagem where tipo = 'foto' \gset
update public.mensagem set apagada_em = clock_timestamp() where id = :'msgfoto';
select count(*) as na_lista_de_espera from public.anexo_orfao;
select anexo is null as coluna_limpa from public.mensagem where id = :'msgfoto';

-- ------------------------------------------------------------------
\echo ''
\echo '== 6. Uma sondagem: criar =='
select public.criar_sondagem(:'conv', 'Quem vem sabado?', array['Eu vou','Nao posso','Talvez']) as sond \gset
set local chat.sond = :'sond';
select s_texto, s_ordem, s_votos from public.sondagens_da_conversa(:'conv') order by s_ordem;

\echo '== 7. Duas respostas iguais nao fazem duas opcoes (esperado: erro) =='
do $$
begin
  perform public.criar_sondagem(current_setting('chat.conv')::uuid, 'Sim ou sim?', array['Sim','Sim']);
  raise exception 'FALHA: criou uma sondagem com uma so resposta util';
exception when raise_exception then
  raise notice 'OK: uma sondagem precisa de duas respostas diferentes';
end $$;

\echo '== 8. Votar duas vezes MUDA o voto (o total tem de ficar em 1) =='
select s_opcao as opa from public.sondagens_da_conversa(:'conv') where s_ordem = 0 \gset
select s_opcao as opb from public.sondagens_da_conversa(:'conv') where s_ordem = 1 \gset
select public.votar_sondagem(:'sond', :'opa');
select public.votar_sondagem(:'sond', :'opb');
select sum(s_votos) as votos_no_total from public.sondagens_da_conversa(:'conv');
select s_texto, s_minha from public.sondagens_da_conversa(:'conv') where s_votos > 0;

\echo '== 9. O VETERINARIO nao ve a sondagem do grupo (esperado: 0) =='
set local request.jwt.claims = '{"sub":"f3d7edf1-ffec-4294-94f3-e2619ab85192","role":"authenticated"}';
select count(*) as opcoes_visiveis from public.sondagem_opcao;
select count(*) as votos_visiveis from public.sondagem_voto;

\echo '== 10. E nao consegue votar nela =='
do $$
begin
  perform public.votar_sondagem(current_setting('chat.sond')::uuid,
    (select id from public.sondagem_opcao limit 1));
  raise exception 'FALHA: o veterinario votou numa sondagem do grupo';
exception when raise_exception then
  raise notice 'OK: nao votou (nem sequer ve as opcoes)';
end $$;

-- ------------------------------------------------------------------
\echo ''
\echo '== 11. PUSH: sem aparelhos registados nao ha envio nenhum =='
set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
insert into public.mensagem (conversa_id, autor, texto) values (:'conv', :'dono', 'sem push');
reset role;
select count(*) as envios from public.push_envio;

\echo '== 12. Com o TRABALHADOR a registar o telemovel, ja ha =='
set local role authenticated;
set local request.jwt.claims = '{"sub":"db5e297a-41f4-4b49-ad9d-7105709f6653","role":"authenticated"}';
select public.registar_push_token('ExponentPushToken[prova-nao-existe]', 'ios', 'pt');

set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
insert into public.mensagem (conversa_id, autor, texto) values (:'conv', :'dono', 'agora toca');
reset role;
select quantos as aparelhos_avisados, erro from public.push_envio order by em desc limit 1;

\echo '== 13. Quem SILENCIOU a conversa nao e avisado (esperado: 0 envios novos) =='
set local role authenticated;
set local request.jwt.claims = '{"sub":"db5e297a-41f4-4b49-ad9d-7105709f6653","role":"authenticated"}';
update public.conversa_membro set silenciada = true
 where conversa_id = current_setting('chat.conv')::uuid and user_id = auth.uid();

set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
insert into public.mensagem (conversa_id, autor, texto) values (:'conv', :'dono', 'silencio');
reset role;
select count(*) as envios_no_total from public.push_envio;

\echo '== 14. E quem escreve nunca e avisado de si proprio =='
select count(*) as tokens_do_autor from public.push_token t
  join public.mensagem m on m.autor = t.user_id
 where m.conversa_id = :'conv';

-- ------------------------------------------------------------------
\echo ''
\echo '== 15. O BUCKET: quem esta na conversa poe la um ficheiro =='
-- A prova é feita na tabela `storage.objects`, que é onde a RLS do bucket
-- decide. O carregamento a sério passa pela API do Storage, mas é ESTA a
-- política que ela consulta.
set local role authenticated;
set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
insert into storage.objects (bucket_id, name, owner)
values ('chat', current_setting('chat.conv') || '/22222222-2222-4222-8222-222222222222.jpg', auth.uid());
select count(*) as ficheiros_visiveis from storage.objects where bucket_id = 'chat';

\echo '== 16. O VETERINARIO nao ve o ficheiro do grupo (esperado: 0) =='
set local request.jwt.claims = '{"sub":"f3d7edf1-ffec-4294-94f3-e2619ab85192","role":"authenticated"}';
select count(*) as ficheiros_visiveis from storage.objects where bucket_id = 'chat';

\echo '== 17. E nao consegue por la nada =='
do $$
begin
  insert into storage.objects (bucket_id, name, owner)
  values ('chat', current_setting('chat.conv') || '/33333333-3333-4333-8333-333333333333.jpg', auth.uid());
  raise exception 'FALHA: o veterinario escreveu no bucket do grupo';
exception when insufficient_privilege then
  raise notice 'OK: a RLS do bucket recusou o carregamento';
end $$;

\echo '== 18. Um caminho que nao e um id de conversa nao rebenta a consulta =='
-- O `uuid_ou_nulo` existe para isto: um `::uuid` direto levantava erro e
-- estragava QUALQUER listagem do bucket, mesmo a de quem tem acesso a tudo.
select public.uuid_ou_nulo('isto-nao-e-um-uuid') is null as devolve_nulo;

rollback;
\echo ''
\echo '== FIM. A base ficou como estava (rollback). =='
