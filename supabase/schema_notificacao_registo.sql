-- ==================================================================
-- Terrabovina — aviso por email quando alguém cria conta
-- ==================================================================
-- Quem se regista fica com `perfil.estado = 'pendente'` e não consegue fazer
-- nada até o superadmin aprovar. O pedido ficava só à espera dentro da app:
-- se ninguém abrisse o painel do superadmin, ninguém sabia que existia. Este
-- ficheiro faz a base de dados avisar por email, no momento do registo.
--
-- Como funciona: um trigger em `public.perfil` chama a API do **Resend** com o
-- `pg_net`, que é assíncrono — põe o pedido HTTP numa fila e um processo em
-- segundo plano trata dele. Ou seja, **o registo nunca espera pelo email**, e
-- se o envio falhar o registo faz-se à mesma (ver a secção 4).
--
-- ------------------------------------------------------------------
-- PREPARAÇÃO (uma só vez por base de dados, ANTES de aplicar este ficheiro)
-- ------------------------------------------------------------------
-- 1. Ligar a extensão `pg_net`: painel do Supabase → Database → Extensions →
--    procurar "pg_net" → Enable. (O `create extension` da secção 1 também a
--    liga, mas em algumas bases só o painel tem permissão para isso.)
--
-- 2. Criar conta em https://resend.com **com o email do superadmin**
--    (terrabovinasuperadmin@gmail.com). Isto não é um detalhe: sem domínio
--    verificado, o Resend só deixa enviar para o email do dono da conta — que
--    por acaso é exatamente o destino que queremos. Plano grátis: 3.000
--    emails por mês, 100 por dia. Chega e sobra para avisos de registo.
--
-- 3. Em Resend → API Keys → Create API Key (permissão "Sending access").
--    Guardar a chave no Vault do Supabase, que é o único sítio desta base
--    onde um segredo fica cifrado — numa tabela normal ficava em texto simples
--    e saía em qualquer backup (`scripts/backup.ps1`):
--
--      select vault.create_secret(
--        're_a_chave_toda_aqui',
--        'resend_api_key',
--        'Chave de envio de email (avisos de registo)'
--      );
--
--    Para TROCAR a chave mais tarde (não é `create_secret` outra vez):
--
--      select vault.update_secret(
--        (select id from vault.secrets where name = 'resend_api_key'),
--        're_a_chave_nova'
--      );
--
-- 4. Aplicar este ficheiro. Depois, confirmar com um envio de teste:
--
--      select public.testar_notificacao_registo();   -- pela app/SQL editor
--      select * from public.notificacoes_recentes(); -- ver como correu
--
--    O `notificacoes_recentes()` mostra o código HTTP devolvido pelo Resend:
--    200 = enviado, 401 = chave errada, 403 = destino não autorizado (não é o
--    email da conta Resend e não há domínio verificado), 422 = remetente
--    inválido. Sem esta consulta, um envio falhado é completamente silencioso.
--
-- Aplica em cima de schema.sql + schema_roles.sql. Idempotente.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Extensão de HTTP
-- ------------------------------------------------------------------
-- O `pg_net` instala-se sempre no schema `net` (não é relocável), mas há bases
-- do Supabase antigas onde as funções ficaram noutro schema. Por isso nada
-- neste ficheiro escreve `net.http_post` à mão: a secção 4 pergunta ao
-- catálogo onde é que a função está. Escrito à mão, bastava essa diferença
-- para o trigger rebentar em produção e em mais lado nenhum.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'Não foi possível ligar a extensão pg_net por SQL (%). Liga-a no painel: Database → Extensions → pg_net.', sqlerrm;
end $$;


-- ------------------------------------------------------------------
-- 2. Configuração
-- ------------------------------------------------------------------
-- Uma só linha. O `check (id)` com chave primária booleana é o truque
-- habitual para uma tabela que nunca pode ter duas linhas: `id` só pode ser
-- `true`, e `true` só cabe lá uma vez.
create table if not exists public.config_notificacao (
  id boolean primary key default true check (id),
  -- Para onde vai o aviso.
  destino text not null default 'terrabovinasuperadmin@gmail.com',
  -- De onde sai. `onboarding@resend.dev` é o remetente de cortesia do Resend,
  -- que funciona sem domínio verificado. Com domínio próprio (terrabovina.pt),
  -- trocar por algo como 'Terrabovina <avisos@terrabovina.pt>'.
  remetente text not null default 'Terrabovina <onboarding@resend.dev>',
  -- Vai no botão do email.
  url_app text not null default 'https://app-gestaogado.netlify.app',
  -- Interruptor geral: a `false`, o trigger não faz nada (nem sequer tenta
  -- ler o segredo). É o que se usa na base de testes, para não encher a caixa
  -- de correio a cada conta de experiência.
  ativo boolean not null default true,
  atualizada_em timestamptz not null default now()
);

insert into public.config_notificacao (id) values (true) on conflict (id) do nothing;

alter table public.config_notificacao enable row level security;

-- Só o superadmin lê ou mexe. Um cliente não tem nada que saber para onde
-- vão os avisos da plataforma.
drop policy if exists config_notificacao_superadmin on public.config_notificacao;
create policy config_notificacao_superadmin on public.config_notificacao
  for all using (public.eh_superadmin()) with check (public.eh_superadmin());


-- ------------------------------------------------------------------
-- 3. Registo dos envios
-- ------------------------------------------------------------------
-- O `pg_net` é assíncrono: quando o trigger termina, o email ainda não saiu.
-- Sem esta tabela não havia forma de ligar "houve um registo às 14h32" ao
-- resultado HTTP que aparece em `net._http_response` — e um envio falhado
-- ficava invisível para sempre.
create table if not exists public.notificacao_envio (
  id uuid primary key default gen_random_uuid(),
  em timestamptz not null default now(),
  motivo text not null,              -- 'registo' | 'teste'
  destino text not null,
  assunto text not null,
  pedido_id bigint,                  -- id devolvido pelo pg_net (null se falhou logo)
  erro text                          -- preenchido quando nem se chegou a enviar
);

alter table public.notificacao_envio enable row level security;

drop policy if exists notificacao_envio_superadmin on public.notificacao_envio;
create policy notificacao_envio_superadmin on public.notificacao_envio
  for select using (public.eh_superadmin());


-- ------------------------------------------------------------------
-- 4. Envio
-- ------------------------------------------------------------------
-- O nome da conta é escrito pela própria pessoa que se regista, no ecrã de
-- registo, e vai parar ao meio do HTML do email. Sem escapar, um nome como
--   Zé</b><a href="http://sitio-falso">Aprovar agora</a><b>
-- desenha um botão à escolha dela dentro de um email que vem da Terrabovina e
-- que o superadmin abre à espera de um pedido legítimo. É pequeno de arranjar
-- e desagradável de descobrir depois.
create or replace function public.escapar_html(t text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(replace(
           coalesce(t, ''),
           '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- `security definer` porque precisa de ler o Vault e de escrever no log —
-- coisas que nenhum papel da app pode fazer diretamente.
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
declare
  cfg          public.config_notificacao;
  chave        text;
  schema_net   text;
  pedido       bigint;
begin
  -- Esta função manda HTML à escolha de quem a chama, a partir do endereço da
  -- plataforma. Exposta em `/rest/v1/rpc/`, era um enviador de emails falsos
  -- em nome da Terrabovina para qualquer pessoa com uma sessão.
  --
  -- E ela FICA exposta: o `schema_lint.sql` varre o schema `public` e dá
  -- `execute` a `authenticated` a todas as funções `security definer` que não
  -- sejam de trigger. Um `revoke` escrito aqui é desfeito na próxima vez que
  -- esse ficheiro correr, sem aviso nenhum. Por isso a porta fecha-se por
  -- dentro, não pela permissão: ou vem de um trigger, ou é o superadmin.
  if pg_trigger_depth() = 0 and not public.eh_superadmin() then
    raise exception 'esta função só é chamada por dentro da base de dados';
  end if;

  select * into cfg from public.config_notificacao where id;

  if cfg is null or not cfg.ativo then
    return null;
  end if;

  -- A chave vive no Vault. Se não estiver lá, o passo 3 da PREPARAÇÃO ficou
  -- por fazer — fica registado no log em vez de rebentar.
  select decrypted_secret into chave
    from vault.decrypted_secrets
   where name = 'resend_api_key'
   limit 1;

  if chave is null or chave = '' then
    insert into public.notificacao_envio (motivo, destino, assunto, erro)
    values (p_motivo, cfg.destino, p_assunto,
            'Falta o segredo "resend_api_key" no Vault (ver PREPARAÇÃO, passo 3).');
    return null;
  end if;

  -- Onde é que o pg_net pôs o `http_post`.
  select n.nspname into schema_net
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'http_post'
     and n.nspname in ('net', 'extensions', 'public')
   order by case n.nspname when 'net' then 1 when 'extensions' then 2 else 3 end
   limit 1;

  if schema_net is null then
    insert into public.notificacao_envio (motivo, destino, assunto, erro)
    values (p_motivo, cfg.destino, p_assunto,
            'A extensão pg_net não está instalada (ver PREPARAÇÃO, passo 1).');
    return null;
  end if;

  -- Os `::` não são decoração: numa consulta dinâmica os `$n` chegam sem tipo
  -- e, em notação nomeada, o Postgres recusa-se a adivinhá-lo.
  execute format(
    'select %I.http_post(url := $1::text, body := $2::jsonb, headers := $3::jsonb, timeout_milliseconds := $4::int)',
    schema_net
  )
  into pedido
  using
    'https://api.resend.com/emails',
    jsonb_build_object(
      'from', cfg.remetente,
      'to', jsonb_build_array(cfg.destino),
      'subject', p_assunto,
      'html', p_html
    ),
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || chave
    ),
    8000;

  insert into public.notificacao_envio (motivo, destino, assunto, pedido_id)
  values (p_motivo, cfg.destino, p_assunto, pedido);

  return pedido;
end;
$$;

revoke all on function public.enviar_email_notificacao(text, text, text) from public, anon, authenticated;


-- ------------------------------------------------------------------
-- 5. O trigger
-- ------------------------------------------------------------------
create or replace function public.notificar_registo_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg      public.config_notificacao;
  u        record;
  nome     text;
  quando   text;
begin
  -- Só interessa quem fica à espera de aprovação. Um perfil criado já ativo
  -- (o superadmin, ou o backfill do `reparar.sql`) não é um pedido.
  if new.estado is distinct from 'pendente' then
    return new;
  end if;

  select email, created_at into u from auth.users where id = new.id;

  -- Guarda contra o `reparar.sql`: esse ficheiro cria perfis em falta de
  -- contas com meses. Sem esta condição, uma reparação de rotina disparava um
  -- email por cada conta antiga da base, de uma vez só.
  if u is null or u.created_at < now() - interval '10 minutes' then
    return new;
  end if;

  select * into cfg from public.config_notificacao where id;
  if cfg is null or not cfg.ativo then
    return new;
  end if;

  nome := nullif(trim(coalesce(new.nome, '')), '');
  quando := to_char(coalesce(u.created_at, now()) at time zone 'Europe/Lisbon', 'DD/MM/YYYY "às" HH24:MI');

  perform public.enviar_email_notificacao(
    'registo',
    'Terrabovina — pedido de acesso pendente' || coalesce(': ' || nome, ''),
    '<div style="font-family:Nunito,Segoe UI,Arial,sans-serif;color:#15251c;line-height:1.6;max-width:520px">'
    || '<h2 style="color:#166b3d;margin:0 0 4px">Novo pedido de acesso</h2>'
    || '<p style="margin:0 0 18px;color:#54655b">Alguém criou conta na Terrabovina e está à espera de aprovação.</p>'
    || '<table style="border-collapse:collapse;font-size:15px">'
    || '<tr><td style="padding:4px 14px 4px 0;color:#869184">Nome</td><td><b>' || public.escapar_html(coalesce(nome, '(não indicado)')) || '</b></td></tr>'
    || '<tr><td style="padding:4px 14px 4px 0;color:#869184">Email</td><td><b>' || public.escapar_html(coalesce(u.email, '(desconhecido)')) || '</b></td></tr>'
    || '<tr><td style="padding:4px 14px 4px 0;color:#869184">Registo</td><td>' || quando || '</td></tr>'
    || '</table>'
    || '<p style="margin:22px 0 0"><a href="' || cfg.url_app || '" style="background:#1b7a48;color:#fff;text-decoration:none;font-weight:800;padding:13px 24px;border-radius:999px;display:inline-block">Abrir o painel</a></p>'
    || '<p style="margin:18px 0 0;font-size:13px;color:#869184">A conta fica sem acesso a nada até ser aprovada em Clientes → Pendentes.</p>'
    || '</div>'
  );

  return new;
exception when others then
  -- REGRA DA CASA: um aviso que falha nunca pode impedir alguém de criar
  -- conta. Sem este `exception`, uma chave de API expirada ou o Vault
  -- indisponível faziam o registo rebentar com um erro que o utilizador não
  -- percebe e não consegue contornar — a app deixava de aceitar clientes
  -- novos por causa do email.
  raise warning 'Aviso de registo não enviado: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_perfil_pendente_notificar on public.perfil;
create trigger on_perfil_pendente_notificar
  after insert on public.perfil
  for each row execute function public.notificar_registo_pendente();


-- ------------------------------------------------------------------
-- 6. Teste e diagnóstico (para o superadmin)
-- ------------------------------------------------------------------
create or replace function public.testar_notificacao_registo()
returns text
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  pedido bigint;
begin
  if not public.eh_superadmin() then
    raise exception 'apenas o superadmin pode testar as notificações';
  end if;

  pedido := public.enviar_email_notificacao(
    'teste',
    'Terrabovina — teste de aviso de registo',
    '<div style="font-family:Nunito,Segoe UI,Arial,sans-serif;color:#15251c">'
    || '<h2 style="color:#166b3d">Teste</h2>'
    || '<p>Se está a ler isto, os avisos de novo registo estão a funcionar.</p>'
    || '</div>'
  );

  if pedido is null then
    return 'Não saiu nada. Ver `select * from public.notificacoes_recentes();` para a razão.';
  end if;

  return 'Pedido ' || pedido || ' enviado para a fila. Confirmar com `select * from public.notificacoes_recentes();` daqui a alguns segundos.';
end;
$$;

-- Junta o que pedimos ao que o Resend respondeu. É aqui que se vê se o email
-- saiu mesmo: o log da secção 3 só prova que o pedido entrou na fila.
create or replace function public.notificacoes_recentes(limite int default 20)
returns table (
  em timestamptz,
  motivo text,
  destino text,
  assunto text,
  estado text,
  detalhe text
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  tem_respostas boolean;
begin
  if not public.eh_superadmin() then
    raise exception 'apenas o superadmin pode ver as notificações';
  end if;

  select exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relname = '_http_response' and n.nspname = 'net'
  ) into tem_respostas;

  if not tem_respostas then
    return query
      select e.em, e.motivo, e.destino, e.assunto,
             coalesce(e.erro, 'na fila')::text,
             'Sem net._http_response nesta base.'::text
        from public.notificacao_envio e
       order by e.em desc
       limit limite;
    return;
  end if;

  return query execute format($q$
    select e.em, e.motivo, e.destino, e.assunto,
           case
             when e.erro is not null then 'nao enviado'
             when r.status_code between 200 and 299 then 'entregue'
             when r.status_code is not null then 'recusado (' || r.status_code || ')'
             when r.error_msg is not null then 'erro de rede'
             else 'na fila'
           end::text,
           coalesce(e.erro, r.error_msg, r.content, '')::text
      from public.notificacao_envio e
      left join net._http_response r on r.id = e.pedido_id
     order by e.em desc
     limit %s
  $q$, limite);
end;
$$;

grant execute on function public.testar_notificacao_registo() to authenticated;
grant execute on function public.notificacoes_recentes(int) to authenticated;
revoke all on function public.testar_notificacao_registo() from public, anon;
revoke all on function public.notificacoes_recentes(int) from public, anon;
revoke all on function public.notificar_registo_pendente() from public, anon, authenticated;

-- As duas RPC validam `eh_superadmin()` na primeira linha, por isso podem
-- estar abertas a `authenticated` — é o mesmo padrão das restantes do painel
-- (ver a nota no fim do `schema_lint.sql`).
