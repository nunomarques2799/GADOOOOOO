-- ==================================================================
-- Terrabovina — a mensagem nova toca no telemóvel (push)
-- ==================================================================
-- Aplica DEPOIS do `schema_chat_sondagens.sql` (é o 38.º; ver `ordem.txt`).
-- Idempotente.
--
-- É a primeira notificação desta app que NÃO é local. Todas as outras
-- (`notificacoesLocais.ts`) são avisos agendados no próprio telemóvel a partir
-- de dados que ele já tem: o prazo do brinco sabe-se com uma semana de
-- antecedência. Uma mensagem não se sabe: ela acontece no telemóvel de outra
-- pessoa, e o aparelho que a tem de mostrar pode estar desligado há três horas.
-- Isso obriga a um servidor a empurrá-la, e o servidor aqui é a base de dados.
--
-- ------------------------------------------------------------------
-- COMO FUNCIONA
-- ------------------------------------------------------------------
-- Um gatilho no `insert` de `mensagem` junta os tokens de quem tem de ser
-- avisado e faz UM pedido HTTP à API de push da Expo, com o `pg_net` — a mesma
-- mecânica do aviso de registo por email (`schema_notificacao_registo.sql`) e
-- pela mesma razão: o `pg_net` é assíncrono, portanto **a mensagem nunca espera
-- pelo aviso**. Se o envio falhar, a mensagem grava na mesma.
--
-- NÃO PRECISA DE CHAVE NENHUMA. A API de push da Expo aceita pedidos sem
-- autenticação (o token de cada aparelho é o segredo), ao contrário do Resend.
-- É por isso que este ficheiro não tem secção de PREPARAÇÃO nem Vault.
--
-- ------------------------------------------------------------------
-- O QUE FALTA FORA DAQUI
-- ------------------------------------------------------------------
-- Isto entrega a mensagem à Expo. Para ela chegar ao iPhone falta o que só se
-- faz na conta da Apple e no EAS, uma vez:
--
--   eas credentials -p ios      → Push Notifications: criar/ligar a chave APNs
--   eas credentials -p android  → carregar as credenciais FCM V1
--
-- e um **build nativo novo** depois disso. Sem a chave, o token nem chega a
-- ser emitido e a app fica como está hoje: avisa só com ela aberta.
--
-- ------------------------------------------------------------------
-- O QUE A NOTIFICAÇÃO DIZ
-- ------------------------------------------------------------------
-- O texto da mensagem VAI no aviso. É o que faz um aviso destes valer alguma
-- coisa (ver "João: o camião chega às 8" no ecrã bloqueado poupa abrir a app),
-- e é o que qualquer app de mensagens faz. Quem não quiser pode silenciar a
-- conversa, e a conta que estiver silenciada não entra na consulta abaixo.
--
-- A LÍNGUA vem do aparelho: cada token guarda a língua em que a app estava
-- quando o registou. Sem isso, "Fotografia" e "Mensagem de voz" saíam sempre em
-- português para quem escolheu inglês, e a tradução da app deixava de estar
-- completa por causa de meia dúzia de palavras que a base é que escreve.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Extensão de HTTP
-- ------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'Não foi possível ligar a extensão pg_net por SQL (%). Liga-a no painel: Database → Extensions → pg_net.', sqlerrm;
end $$;


-- ------------------------------------------------------------------
-- 2. Os tokens
-- ------------------------------------------------------------------
-- Um por aparelho. A mesma pessoa tem o telemóvel e o tablet; o mesmo aparelho
-- pode mudar de dono (o token passa para a conta que o registou por último, que
-- é o que o `on conflict` da secção 4 garante).
create table if not exists public.push_token (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plataforma text not null default 'desconhecida'
    check (plataforma in ('ios', 'android', 'web', 'desconhecida')),
  /** A língua da app quando o token foi registado. Ver o cabeçalho. */
  idioma text not null default 'pt' check (idioma in ('pt', 'en')),
  criado_em timestamptz not null default clock_timestamp(),
  visto_em timestamptz not null default clock_timestamp()
);

create index if not exists idx_push_token_user on public.push_token (user_id);

alter table public.push_token enable row level security;

-- Cada um vê e apaga os seus. Ninguém lista os dos outros: com um token alheio
-- na mão, qualquer pessoa mandava avisos ao telemóvel de outra.
drop policy if exists push_token_self_select on public.push_token;
create policy push_token_self_select on public.push_token
  for select using (user_id = auth.uid());

drop policy if exists push_token_self_delete on public.push_token;
create policy push_token_self_delete on public.push_token
  for delete using (user_id = auth.uid());

-- Registar é pelo RPC da secção 4 (que trata do caso de o token já estar
-- noutra conta). Sem insert nem update diretos.
revoke insert, update on public.push_token from anon, authenticated;
revoke truncate, trigger, references on public.push_token from anon, authenticated;


-- ------------------------------------------------------------------
-- 3. Registo de envios (para se saber porque é que não tocou)
-- ------------------------------------------------------------------
-- Sem isto, um envio falhado é completamente silencioso: a app não sabe que a
-- notificação existia, e ninguém tem por onde perguntar.
create table if not exists public.push_envio (
  id bigserial primary key,
  mensagem_id uuid,
  quantos integer not null default 0,
  pedido_id bigint,
  erro text,
  em timestamptz not null default clock_timestamp()
);

create index if not exists idx_push_envio_em on public.push_envio (em desc);

alter table public.push_envio enable row level security;
-- Ninguém lê isto pela app: é diagnóstico de quem administra a base, pelo
-- `push_recentes()` da secção 6 (que é `security definer` e só responde ao
-- superadmin). Sem políticas, a tabela fica fechada a toda a gente.
revoke select, insert, update, delete on public.push_envio from anon, authenticated;
revoke truncate, trigger, references on public.push_envio from anon, authenticated;


-- ------------------------------------------------------------------
-- 4. Registar o token deste aparelho
-- ------------------------------------------------------------------
create or replace function public.registar_push_token(
  p_token text,
  p_plataforma text default 'desconhecida',
  p_idioma text default 'pt'
)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'sem sessão iniciada';
  end if;
  if coalesce(btrim(p_token), '') = '' then
    return;
  end if;

  insert into public.push_token (token, user_id, plataforma, idioma)
  values (
    btrim(p_token),
    auth.uid(),
    case when p_plataforma in ('ios', 'android', 'web') then p_plataforma else 'desconhecida' end,
    case when p_idioma = 'en' then 'en' else 'pt' end
  )
  -- O mesmo aparelho a entrar noutra conta muda de dono. Sem isto, o token
  -- ficava preso à primeira conta que o registou e o telemóvel continuava a
  -- receber as mensagens de quem já saiu dele.
  on conflict (token) do update
    set user_id = excluded.user_id,
        plataforma = excluded.plataforma,
        idioma = excluded.idioma,
        visto_em = clock_timestamp();
end;
$$;

/** Esquece este aparelho. A app chama-o ao terminar sessão. */
create or replace function public.esquecer_push_token(p_token text)
returns void language sql security definer set search_path = 'public' as $$
  delete from public.push_token
   where token = btrim(p_token) and user_id = auth.uid();
$$;


-- ------------------------------------------------------------------
-- 5. O envio
-- ------------------------------------------------------------------

/**
 * O texto do aviso, na língua de cada aparelho.
 *
 * Função à parte (e não texto colado no gatilho) para caber num teste de olho:
 * `select public.push_texto('foto', 'x', 'en');`
 */
create or replace function public.push_texto(p_tipo text, p_texto text, p_idioma text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_tipo = 'texto' then p_texto
    when p_tipo = 'sondagem' then p_texto
    when p_tipo = 'foto' then case when p_idioma = 'en' then 'Photo' else 'Fotografia' end
    when p_tipo = 'audio' then case when p_idioma = 'en' then 'Voice message' else 'Mensagem de voz' end
    when p_tipo = 'local' then case when p_idioma = 'en' then 'Location' else 'Localização' end
    else p_texto
  end;
$$;

/**
 * Quem tem de ser avisado desta mensagem, e em que aparelhos.
 *
 * Fica de fora: quem a escreveu, quem saiu da conversa, quem a silenciou, e
 * quem não tem aparelho registado. Repare-se que NÃO se pergunta se a pessoa
 * está com a app aberta: isso não se sabe daqui, e o sistema operativo do
 * telemóvel já não mostra o aviso de uma app que está à frente.
 */
create or replace function public.push_destinos(msg_id uuid)
returns table (token text, idioma text)
language sql security definer stable set search_path = 'public' as $$
  select t.token, t.idioma
    from public.mensagem m
    join public.conversa_membro cm
      on cm.conversa_id = m.conversa_id
     and cm.saiu_em is null
     and cm.user_id is distinct from m.autor
     and cm.silenciada = false
    join public.push_token t on t.user_id = cm.user_id
   where m.id = msg_id;
$$;

create or replace function public.chat_push_ao_inserir()
returns trigger language plpgsql security definer set search_path = 'public' as $$
declare
  schema_net text;
  pedido bigint;
  corpo jsonb;
  quantos integer;
  titulo_grupo text;
  nome_autor text;
begin
  -- Como quem escreve a conversa se chama, e como se chama a conversa. Numa
  -- privada o título é o nome de quem escreveu; num grupo é o nome do grupo,
  -- com o nome de quem escreveu à frente do texto.
  select coalesce(nullif(btrim(p.nome), ''), 'Alguém') into nome_autor
    from public.perfil p where p.id = new.autor;

  select case when c.tipo = 'grupo'
              then coalesce(nullif(btrim(c.nome), ''), nullif(btrim(e.nome), ''), 'Exploração')
         end
    into titulo_grupo
    from public.conversa c
    left join public.exploracao e on e.id = c.exploracao_id
   where c.id = new.conversa_id;

  select jsonb_agg(
           jsonb_build_object(
             'to', d.token,
             'title', coalesce(titulo_grupo, coalesce(nome_autor, 'Terrabovina')),
             'body', case
                       when titulo_grupo is null
                         then public.push_texto(new.tipo, new.texto, d.idioma)
                       else coalesce(nome_autor, '') || ': ' ||
                            public.push_texto(new.tipo, new.texto, d.idioma)
                     end,
             'sound', 'default',
             -- É o que o toque no aviso usa para abrir a conversa certa.
             'data', jsonb_build_object('conversaId', new.conversa_id::text),
             'channelId', 'mensagens'
           )
         ),
         count(*)
    into corpo, quantos
    from public.push_destinos(new.id) d;

  if corpo is null or quantos = 0 then
    return new;
  end if;

  select n.nspname into schema_net
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'http_post'
     and n.nspname in ('net', 'extensions', 'public')
   order by case n.nspname when 'net' then 1 when 'extensions' then 2 else 3 end
   limit 1;

  if schema_net is null then
    insert into public.push_envio (mensagem_id, quantos, erro)
    values (new.id, quantos, 'A extensão pg_net não está instalada.');
    return new;
  end if;

  execute format(
    'select %I.http_post(url := $1::text, body := $2::jsonb, headers := $3::jsonb, timeout_milliseconds := $4::int)',
    schema_net
  )
  into pedido
  using
    'https://exp.host/--/api/v2/push/send',
    corpo,
    jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    8000;

  insert into public.push_envio (mensagem_id, quantos, pedido_id)
  values (new.id, quantos, pedido);

  return new;
exception when others then
  -- NUNCA rebentar a gravação da mensagem por causa do aviso. Uma mensagem que
  -- não é enviada porque a notificação falhou é muito pior do que uma
  -- notificação que não toca.
  begin
    insert into public.push_envio (mensagem_id, quantos, erro) values (new.id, 0, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;

-- Depois do `trg_chat_mensagem` (que atualiza a `ultima_em`), por ordem
-- alfabética do nome: os gatilhos `after` correm por essa ordem, e este é o que
-- pode demorar.
drop trigger if exists trg_chat_push on public.mensagem;
create trigger trg_chat_push
  after insert on public.mensagem
  for each row execute function public.chat_push_ao_inserir();


-- ------------------------------------------------------------------
-- 6. Diagnóstico
-- ------------------------------------------------------------------
-- `select * from public.push_recentes();` — o que saiu e o que a Expo respondeu.
--
-- Na resposta da Expo, o que interessa é o `status` de cada bilhete:
--   "ok"                      → entregue à Apple/Google
--   "DeviceNotRegistered"     → o token morreu (a app foi desinstalada)
--   "MessageTooBig" / "MessageRateExceeded" → o que o nome diz
create or replace function public.push_recentes(limite integer default 20)
returns table (em timestamptz, mensagem uuid, quantos integer, estado text, detalhe text)
language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then
    raise exception 'só o superadmin vê isto';
  end if;

  if to_regclass('net._http_response') is null then
    return query
      select e.em, e.mensagem_id, e.quantos,
             coalesce(e.erro, 'sem pg_net')::text, ''::text
        from public.push_envio e
       order by e.em desc
       limit limite;
    return;
  end if;

  return query execute format($q$
    select e.em, e.mensagem_id, e.quantos,
           case
             when e.erro is not null then 'nao enviado'
             when r.status_code between 200 and 299 then 'entregue'
             when r.status_code is not null then 'recusado (' || r.status_code || ')'
             when r.error_msg is not null then 'erro de rede'
             else 'na fila'
           end::text,
           coalesce(e.erro, r.error_msg, left(r.content, 500), '')::text
      from public.push_envio e
      left join net._http_response r on r.id = e.pedido_id
     order by e.em desc
     limit %s
  $q$, limite);
end;
$$;

/**
 * Limpa os tokens que a Expo já disse estarem mortos.
 *
 * Não corre sozinha: chama-se à mão quando o `push_recentes()` mostrar muitos
 * `DeviceNotRegistered`. Um token morto não faz mal nenhum além de ocupar uma
 * linha e um bilhete em cada envio.
 */
create or replace function public.limpar_push_tokens(dias integer default 180)
returns integer language plpgsql security definer set search_path = 'public' as $$
declare
  quantos integer;
begin
  if not public.eh_superadmin() then
    raise exception 'só o superadmin faz isto';
  end if;
  delete from public.push_token where visto_em < now() - make_interval(days => dias);
  get diagnostics quantos = row_count;
  return quantos;
end;
$$;


-- ------------------------------------------------------------------
-- 7. Privilégios
-- ------------------------------------------------------------------
revoke execute on function public.registar_push_token(text, text, text) from anon, public;
revoke execute on function public.esquecer_push_token(text) from anon, public;
revoke execute on function public.push_texto(text, text, text) from anon, public;
revoke execute on function public.push_recentes(integer) from anon, public;
revoke execute on function public.limpar_push_tokens(integer) from anon, public;
revoke execute on function public.push_destinos(uuid) from anon, public, authenticated;
revoke execute on function public.chat_push_ao_inserir() from anon, public, authenticated;

grant execute on function public.registar_push_token(text, text, text) to authenticated;
grant execute on function public.esquecer_push_token(text) to authenticated;
grant execute on function public.push_recentes(integer) to authenticated;
grant execute on function public.limpar_push_tokens(integer) to authenticated;
-- O `push_texto` fica fechado: é usado por dentro do gatilho e mais nada.


notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. O gatilho existe e não estorva: escrever uma mensagem numa conversa sem
--    tokens registados grava na mesma e não deixa registo de envio.
--
--   insert into public.mensagem (conversa_id, autor, texto) values ('<conv>', '<user>', 'olá');
--   select * from public.push_envio order by em desc limit 3;   -- vazio
--
-- 2. Com um token registado, sai um pedido:
--
--   select public.registar_push_token('ExponentPushToken[xxxxxxxx]', 'ios', 'pt');
--   -- (a partir de OUTRA conta, escrever na mesma conversa)
--   select * from public.push_recentes();
--
-- 3. O texto muda de língua com o aparelho:
--
--   select public.push_texto('foto', '', 'pt'), public.push_texto('foto', '', 'en');
