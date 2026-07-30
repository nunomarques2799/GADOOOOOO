-- ==================================================================
-- Terrabovina — escrever ao apoio e reportar um problema, de dentro da app
-- ==================================================================
-- Aplica DEPOIS de schema_notificacao_registo.sql (16). Idempotente.
--
-- O QUE MUDA NA APP
--
-- A Ajuda tinha um botão "Enviar email" que abria o `mailto:` do aparelho. Num
-- telemóvel Android sem conta de correio configurada — que é o caso do criador
-- para quem esta app é feita — esse botão não faz nada: nem abre, nem explica,
-- nem falha à vista. Quem o carrega fica convencido de que escreveu e ninguém
-- do outro lado recebeu coisa nenhuma.
--
-- Passa a haver um formulário dentro da app (assunto + texto), e é a base de
-- dados que envia, pela mesma via do aviso de registo novo. O mesmo caminho
-- serve o "Reportar um problema", que é a mesma coisa com outro assunto e com
-- os dados do aparelho colados ao fim.
--
-- A REESTRUTURAÇÃO QUE ISTO OBRIGOU (e porquê)
--
-- O envio vivia em `public.enviar_email_notificacao`, protegido por uma
-- verificação lá dentro: «ou vens de um trigger, ou és o superadmin». A porta
-- está fechada por dentro e não pela permissão porque o `schema_lint.sql`
-- devolve o `execute` a `authenticated` a todas as funções `security definer`
-- do schema `public` — um `revoke` escrito lá seria desfeito na aplicação
-- seguinte, calado.
--
-- Só que agora é preciso que uma função chamada por um utilizador normal envie
-- um email. Baixar aquela verificação abriria `enviar_email_notificacao` (que
-- manda HTML à escolha de quem chama, a partir do endereço da plataforma) a
-- qualquer pessoa com sessão iniciada — ou seja, um enviador de emails falsos
-- em nome da Terrabovina.
--
-- A saída é mudar o envio de sítio: o motor passa a viver no schema `interno`,
-- que o PostgREST não expõe e que o `schema_lint.sql` não varre (ele só olha
-- para `public`). Quem manda emails de verdade fica fora do alcance da API, e
-- em `public` ficam só as duas portas estreitas: o aviso de registo (trigger) e
-- a mensagem de apoio (com travão de ritmo e texto escapado).
--
-- PREPARAÇÃO: a mesma do ficheiro 16 — `pg_net` ligado e a chave do Resend no
-- Vault. Este ficheiro não acrescenta passos nenhuns; se o 16 funciona, este
-- funciona.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Um schema fora da API
-- ------------------------------------------------------------------
-- O PostgREST só serve o que estiver nos schemas expostos (`public`, por
-- omissão). Nada aqui dentro é alcançável por `/rest/v1/rpc/`, aconteça o que
-- acontecer às permissões.
create schema if not exists interno;

revoke all on schema interno from public;
revoke usage on schema interno from anon, authenticated;


-- ------------------------------------------------------------------
-- 2. Quem pediu o envio
-- ------------------------------------------------------------------
-- O log de envios existia sem autor, porque só havia um remetente possível: o
-- trigger do registo. Com as mensagens de apoio há uma pessoa por trás de cada
-- linha, e é essa coluna que o travão de ritmo da secção 4 conta.
alter table public.notificacao_envio
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists idx_notificacao_envio_user_em
  on public.notificacao_envio (user_id, em desc);


-- ------------------------------------------------------------------
-- 3. O motor de envio
-- ------------------------------------------------------------------
-- É o corpo que estava em `public.enviar_email_notificacao`, com duas adições:
-- o `reply_to` (para o superadmin poder responder à pessoa sem ter de copiar o
-- endereço à mão) e o autor, para o log.
create or replace function interno.enviar_email(
  p_motivo    text,
  p_assunto   text,
  p_html      text,
  p_reply_to  text default null,
  p_user      uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg          public.config_notificacao;
  chave        text;
  schema_net   text;
  corpo        jsonb;
  pedido       bigint;
begin
  select * into cfg from public.config_notificacao where id;

  if cfg is null or not cfg.ativo then
    return null;
  end if;

  select decrypted_secret into chave
    from vault.decrypted_secrets
   where name = 'resend_api_key'
   limit 1;

  if chave is null or chave = '' then
    insert into public.notificacao_envio (motivo, destino, assunto, erro, user_id)
    values (p_motivo, cfg.destino, p_assunto,
            'Falta o segredo "resend_api_key" no Vault (ver PREPARAÇÃO do schema_notificacao_registo.sql).',
            p_user);
    return null;
  end if;

  -- Onde é que o pg_net pôs o `http_post` (ver a nota do ficheiro 16: o schema
  -- varia entre bases, e escrevê-lo à mão partia numa delas e mais em nenhuma).
  select n.nspname into schema_net
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'http_post'
     and n.nspname in ('net', 'extensions', 'public')
   order by case n.nspname when 'net' then 1 when 'extensions' then 2 else 3 end
   limit 1;

  if schema_net is null then
    insert into public.notificacao_envio (motivo, destino, assunto, erro, user_id)
    values (p_motivo, cfg.destino, p_assunto,
            'A extensão pg_net não está instalada (ver PREPARAÇÃO do schema_notificacao_registo.sql).',
            p_user);
    return null;
  end if;

  corpo := jsonb_build_object(
    'from', cfg.remetente,
    'to', jsonb_build_array(cfg.destino),
    'subject', p_assunto,
    'html', p_html
  );

  -- Só se houver para onde responder. O Resend recusa o pedido inteiro (422)
  -- se o `reply_to` vier vazio ou malformado, e uma mensagem de apoio perdida
  -- por causa do campo de conveniência seria o pior dos dois mundos.
  if p_reply_to is not null and position('@' in p_reply_to) > 1 then
    corpo := corpo || jsonb_build_object('reply_to', p_reply_to);
  end if;

  execute format(
    'select %I.http_post(url := $1::text, body := $2::jsonb, headers := $3::jsonb, timeout_milliseconds := $4::int)',
    schema_net
  )
  into pedido
  using
    'https://api.resend.com/emails',
    corpo,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || chave
    ),
    8000;

  insert into public.notificacao_envio (motivo, destino, assunto, pedido_id, user_id)
  values (p_motivo, cfg.destino, p_assunto, pedido, p_user);

  return pedido;
end;
$$;

revoke all on function interno.enviar_email(text, text, text, text, uuid) from public, anon, authenticated;


-- ------------------------------------------------------------------
-- 4. A porta do aviso de registo continua onde estava
-- ------------------------------------------------------------------
-- Mantém-se a assinatura e a verificação: o trigger do ficheiro 16 chama-a por
-- nome e não pode saber que o motor mudou de casa.
create or replace function public.enviar_email_notificacao(
  p_motivo text,
  p_assunto text,
  p_html text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 0 and not public.eh_superadmin() then
    raise exception 'esta função só é chamada por dentro da base de dados';
  end if;
  return interno.enviar_email(p_motivo, p_assunto, p_html, null, auth.uid());
end;
$$;


-- ------------------------------------------------------------------
-- 5. A mensagem de apoio e o reporte de problema
-- ------------------------------------------------------------------
-- A única função deste ficheiro que `authenticated` pode chamar. O que a torna
-- segura não é a permissão (o 17 devolve-lha na mesma) — é o que ela NÃO deixa
-- fazer: o destino é fixo, o remetente é fixo, o HTML é montado aqui e tudo o
-- que vem do cliente passa por `escapar_html`. Quem a chamar mil vezes seguidas
-- consegue mandar mil emails para o mesmo sítio, e é isso que o travão trava.
create or replace function public.enviar_mensagem_apoio(
  p_tipo      text,
  p_assunto   text,
  p_texto     text,
  -- Diagnóstico do aparelho (versão da app, sistema). Vem da app; é texto e é
  -- escapado como o resto.
  p_contexto  text default null
)
returns text
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  quem      uuid := auth.uid();
  email     text;
  nome      text;
  assunto   text;
  na_hora   int;
  no_dia    int;
  e_bug     boolean;
  titulo    text;
  pedido    bigint;
begin
  if quem is null then
    raise exception 'É preciso ter sessão iniciada para nos escrever.';
  end if;
  if p_tipo is null or p_tipo not in ('apoio', 'bug') then
    raise exception 'Tipo de mensagem desconhecido.';
  end if;

  p_assunto := btrim(coalesce(p_assunto, ''));
  p_texto   := btrim(coalesce(p_texto, ''));

  if p_assunto = '' then
    raise exception 'Escreva um assunto.';
  end if;
  if length(p_texto) < 10 then
    raise exception 'Escreva um pouco mais: com menos de dez letras não conseguimos ajudar.';
  end if;
  -- Limites generosos, mas limites: sem eles, um campo de texto ligado a uma
  -- API de email paga é um convite a mandar megabytes por engano (ou não).
  if length(p_assunto) > 150 then
    raise exception 'O assunto é demasiado comprido.';
  end if;
  if length(p_texto) > 4000 then
    raise exception 'A mensagem é demasiado comprida. Conte o essencial e nós perguntamos o resto.';
  end if;

  -- Travão de ritmo. Conta o que ESTA pessoa mandou, não o total: o limite do
  -- Resend (100 por dia no plano grátis) é partilhado por toda a gente, e um
  -- utilizador a repetir "não funciona" vinte vezes gastava a quota que faz
  -- falta para os avisos de registo.
  select count(*) into na_hora
    from public.notificacao_envio
   where user_id = quem and motivo in ('apoio', 'bug') and em > now() - interval '1 hour';
  if na_hora >= 5 then
    raise exception 'Já nos enviou várias mensagens nesta hora. Aguarde um pouco — vamos responder a todas.';
  end if;

  select count(*) into no_dia
    from public.notificacao_envio
   where user_id = quem and motivo in ('apoio', 'bug') and em > now() - interval '24 hours';
  if no_dia >= 20 then
    raise exception 'Chegou ao limite de mensagens de hoje. Tente amanhã, ou aguarde a nossa resposta.';
  end if;

  select u.email into email from auth.users u where u.id = quem;
  select btrim(coalesce(p.nome, '')) into nome from public.perfil p where p.id = quem;
  nome := nullif(nome, '');

  e_bug := p_tipo = 'bug';
  titulo := case when e_bug then 'Problema reportado' else 'Mensagem de apoio' end;
  assunto := case when e_bug then 'Terrabovina — problema: ' else 'Terrabovina — apoio: ' end || p_assunto;

  pedido := interno.enviar_email(
    p_tipo,
    left(assunto, 200),
    '<div style="font-family:Nunito,Segoe UI,Arial,sans-serif;color:#15251c;line-height:1.6;max-width:560px">'
    || '<h2 style="color:' || case when e_bug then '#a4401f' else '#166b3d' end || ';margin:0 0 4px">'
    || titulo || '</h2>'
    || '<p style="margin:0 0 18px;color:#54655b">' || public.escapar_html(p_assunto) || '</p>'
    || '<table style="border-collapse:collapse;font-size:15px;margin-bottom:18px">'
    || '<tr><td style="padding:4px 14px 4px 0;color:#869184">De</td><td><b>'
       || public.escapar_html(coalesce(nome, '(sem nome)')) || '</b></td></tr>'
    || '<tr><td style="padding:4px 14px 4px 0;color:#869184">Email</td><td><b>'
       || public.escapar_html(coalesce(email, '(desconhecido)')) || '</b></td></tr>'
    || '<tr><td style="padding:4px 14px 4px 0;color:#869184">Quando</td><td>'
       || to_char(now() at time zone 'Europe/Lisbon', 'DD/MM/YYYY "às" HH24:MI') || '</td></tr>'
    || '</table>'
    -- `white-space:pre-wrap` porque o texto vem de uma caixa de várias linhas e
    -- o HTML come os parágrafos: sem isto, uma descrição de um problema chegava
    -- como um bloco corrido de quinze linhas.
    || '<div style="white-space:pre-wrap;background:#f4f7f4;border-radius:12px;padding:16px;font-size:15px">'
       || public.escapar_html(p_texto) || '</div>'
    || coalesce(
         '<p style="margin:18px 0 0;font-size:13px;color:#869184">'
         || public.escapar_html(nullif(btrim(p_contexto), '')) || '</p>',
         '')
    || '</div>',
    email,
    quem
  );

  if pedido is null then
    -- Não saiu. Devolve-se a verdade, não um "obrigado": alguém que julga ter
    -- reportado um problema e não reportou fica à espera de uma resposta que
    -- nunca vem, e não volta a tentar por outra via.
    raise exception 'Não foi possível enviar a mensagem agora. Tente daqui a pouco.';
  end if;

  return case when e_bug then 'Problema enviado' else 'Mensagem enviada' end;
end;
$$;

revoke all on function public.enviar_mensagem_apoio(text, text, text, text) from public, anon;
grant execute on function public.enviar_mensagem_apoio(text, text, text, text) to authenticated;


-- ------------------------------------------------------------------
-- Funções novas: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Com uma sessão normal (não superadmin), a mensagem sai:
--
--   select public.enviar_mensagem_apoio('apoio', 'Teste',
--            'Isto é uma mensagem de teste com mais de dez letras.');
--   select * from public.notificacoes_recentes();   -- (como superadmin)
--
-- 2. O motor NÃO está ao alcance da API — as duas têm de falhar:
--
--   select interno.enviar_email('teste', 'x', '<p>x</p>');
--   -- ERROR: permission denied for schema interno
--   select public.enviar_email_notificacao('teste', 'x', '<p>x</p>');
--   -- ERROR: esta função só é chamada por dentro da base de dados
--
-- 3. O travão de ritmo trava (à sexta seguida na mesma hora):
--
--   -- ERROR: Já nos enviou várias mensagens nesta hora.
--
-- 4. O registo de contas novas continua a avisar (é o que esta reestruturação
--    não pode ter partido):
--
--   select public.testar_notificacao_registo();
