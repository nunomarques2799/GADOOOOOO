-- ==================================================================
-- Prova da fila de moderação (a porta do superadmin ao conteúdo)
-- ==================================================================
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" $url -f supabase\provar_denuncias.sql
--
-- Irmão do `provar_chat.sql` e do `provar_chat_anexos.sql`: mesma mecânica
-- (impersonar cada papel, tudo numa transação que acaba em ROLLBACK) e os
-- mesmos UUID da base de DEV lá em cima.
--
-- PORQUE É QUE ESTA PROVA EXISTE
--
-- O ecrã de denúncias do painel de superadmin (`(superadmin)/denuncias.tsx`)
-- lê a tabela `mensagem_denuncia` DIRETAMENTE, sem RPC pelo meio. Quem decide
-- quem lá chega é a RLS e mais nada, e é exatamente isso que se prova aqui: a
-- única porta do superadmin a conteúdo de conversas é a que alguém lhe abriu
-- ao carregar em "denunciar", e ela não escancara mais nada.
--
-- Se um dia alguém "arrumar" as políticas e puser um `eh_superadmin()` no
-- `schema_chat.sql`, é o passo 3 que grita.
--
-- Para correr noutra base, trocar os UUID:
--   select p.id, p.nome, p.is_superadmin from public.perfil p;

\set ON_ERROR_STOP on
\set QUIET on

\set dono   '0e3de665-0d6f-41ac-bbe5-7ac9db214e7a'
\set trab   'db5e297a-41f4-4b49-ad9d-7105709f6653'
\set vet    'f3d7edf1-ffec-4294-94f3-e2619ab85192'
\set super  'bb5af4d7-3e32-4c9a-ab89-426b52334119'
\set exp    'demo-exp-cabeco'

begin;

insert into public.membro_exploracao (user_id, exploracao_id, role)
values (:'trab', :'exp', 'trabalhador');

select id as conv from public.conversa where exploracao_id = :'exp' and tipo = 'grupo' \gset
set local chat.conv = :'conv';
set local chat.dono = :'dono';
set local chat.trab = :'trab';

set local role authenticated;

-- Três mensagens do dono para servirem de contexto, e a quarta é a que leva a
-- denúncia. Todas na mesma conversa e por ordem: é o `clock_timestamp()` do
-- `criado_em` que as separa (com `now()` ficavam todas com a mesma hora e o
-- contexto vinha desordenado).
set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
insert into public.mensagem (conversa_id, autor, texto)
values (:'conv', :'dono', 'Bom dia.'), (:'conv', :'dono', 'A 12 esta a mancar.'),
       (:'conv', :'dono', 'Vou chamar o veterinario.'), (:'conv', :'dono', 'Isto nao se diz.');

select id as msg from public.mensagem
 where conversa_id = :'conv' and texto = 'Isto nao se diz.' \gset
set local chat.msg = :'msg';

-- ------------------------------------------------------------------
\echo ''
\echo '== 1. Nao se denuncia a PROPRIA mensagem =='
-- O `raise exception` do FALHA e o do `denunciar_mensagem` sao os DOIS P0001
-- (`raise_exception`). Um `exception when raise_exception` a envolver os dois
-- apanhava o proprio FALHA e dava OK a uma prova que tinha falhado. Por isso a
-- recusa e apanhada num bloco INTERIOR e o grito fica de fora dele.
do $$
declare
  passou boolean := false;
begin
  begin
    perform public.denunciar_mensagem(current_setting('chat.msg')::uuid, 'teste');
    passou := true;
  exception when raise_exception then
    raise notice 'OK: recusada a denuncia da propria mensagem';
  end;
  if passou then
    raise exception 'FALHA: o autor denunciou-se a si proprio';
  end if;
end $$;

-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"db5e297a-41f4-4b49-ad9d-7105709f6653","role":"authenticated"}';
\echo ''
\echo '== 2. O trabalhador denuncia, e a fila fica com a COPIA e as 3 anteriores =='
select public.denunciar_mensagem(:'msg', 'linguagem ofensiva');

-- Lida como dona da base (o trabalhador nao le esta tabela: e o passo 3).
reset role;
select texto_copia, motivo, estado, jsonb_array_length(contexto) as anteriores
  from public.mensagem_denuncia
 where mensagem_id = current_setting('chat.msg')::uuid;

\echo '== 2b. E as anteriores sao mesmo as tres que vieram antes, por ordem =='
select ord, c ->> 'texto' as texto
  from public.mensagem_denuncia d,
       lateral jsonb_array_elements(d.contexto) with ordinality as t(c, ord)
 where d.mensagem_id = current_setting('chat.msg')::uuid
 order by ord;

set local role authenticated;

-- ------------------------------------------------------------------
\echo ''
\echo '== 3. NINGUEM le a fila: nem quem denunciou, nem o dono da conversa =='
\echo '     (esperado: 0 e 0 -- e a RLS a devolver zero linhas, nao um erro)'
select count(*) as fila_para_quem_denunciou from public.mensagem_denuncia;

set local request.jwt.claims = '{"sub":"0e3de665-0d6f-41ac-bbe5-7ac9db214e7a","role":"authenticated"}';
select count(*) as fila_para_o_dono from public.mensagem_denuncia;

-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"bb5af4d7-3e32-4c9a-ab89-426b52334119","role":"authenticated"}';
\echo ''
\echo '== 4. O SUPERADMIN le a fila (esperado: 1) =='
select count(*) as fila_para_o_superadmin from public.mensagem_denuncia;

\echo '== 5. E CONTINUA sem ler a conversa de onde ela veio (esperado: 0, 0 e 0) =='
\echo '     Esta e a linha que separa "moderar" de "ler as conversas dos clientes".'
select count(*) as conversas_visiveis from public.conversa;
select count(*) as mensagens_visiveis from public.mensagem;
select count(*) as membros_visiveis   from public.conversa_membro;

\echo '== 6. A conta da barra bate certo (esperado: 1) =='
select public.denuncias_por_tratar() as por_tratar;

\echo '== 7. E pode dar por tratada (esperado: tratada, com hora e nota) =='
update public.mensagem_denuncia
   set estado = 'tratada', tratado_em = now(), nota_superadmin = 'avisado por telefone'
 where mensagem_id = current_setting('chat.msg')::uuid;
select estado, (tratado_em is not null) as tem_hora, nota_superadmin
  from public.mensagem_denuncia
 where mensagem_id = current_setting('chat.msg')::uuid;

\echo '== 8. Tratada, sai da conta da barra (esperado: 0) =='
select public.denuncias_por_tratar() as por_tratar;

-- ------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"db5e297a-41f4-4b49-ad9d-7105709f6653","role":"authenticated"}';
\echo ''
\echo '== 9. E mais ninguem a fecha nem a apaga =='
do $$
declare
  mexidas int;
begin
  update public.mensagem_denuncia set estado = 'tratada' where estado = 'aberta';
  get diagnostics mexidas = row_count;
  if mexidas > 0 then
    raise exception 'FALHA: uma sessao normal fechou % denuncia(s)', mexidas;
  end if;
  raise notice 'OK: a RLS nao deixou o trabalhador mexer na fila (0 linhas)';
end $$;

-- O delete nao da erro: a tabela nao tem politica de delete nenhuma, e sem
-- politica a RLS nao entrega LINHA nenhuma para apagar. Por isso a prova e a
-- contagem de linhas afetadas, e nao o erro que nunca vem.
do $$
declare
  apagadas int;
begin
  delete from public.mensagem_denuncia;
  get diagnostics apagadas = row_count;
  if apagadas > 0 then
    raise exception 'FALHA: uma sessao normal apagou % denuncia(s)', apagadas;
  end if;
  raise notice 'OK: o delete nao apagou nada (a RLS nao tem politica de delete)';
exception when insufficient_privilege then
  raise notice 'OK: o grant de tabela recusou o delete';
end $$;

reset role;
\echo ''
\echo '== 10. E a fila continua la, inteira (esperado: 1) =='
select count(*) as ainda_na_fila from public.mensagem_denuncia
 where mensagem_id = current_setting('chat.msg')::uuid;

rollback;
\echo ''
\echo '== FIM. A base ficou como estava (rollback). =='

-- ------------------------------------------------------------------
-- O QUE ESTA PROVA NÃO ALCANÇA
-- ------------------------------------------------------------------
-- O FICHEIRO denunciado. A política `chat_bucket_read` (no
-- `schema_chat_anexos.sql`) deixa o superadmin ler o objeto cujo `name` está
-- numa linha desta fila, mas quem entrega os bytes é a API do Storage e não o
-- Postgres: um `select` em `storage.objects` prova a política e não prova o
-- download. Isso vê-se na app, a abrir uma denúncia de fotografia.
--
-- Para provar só a política, com a denúncia já inserida acima:
--   select count(*) from storage.objects where bucket_id = 'chat';
-- a impersonar o superadmin, tem de dar exatamente os ficheiros denunciados.
