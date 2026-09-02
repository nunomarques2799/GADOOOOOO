-- ==================================================================
-- Terrabovina — o que se manda numa conversa além de texto
-- ==================================================================
-- Aplica DEPOIS do `schema_chat.sql` (é o 36.º; ver `ordem.txt`).
-- Idempotente.
--
-- Traz três coisas à mensagem: FOTOGRAFIA, ÁUDIO e LOCALIZAÇÃO. As sondagens
-- vêm no ficheiro seguinte, e VÍDEO não vem nenhum: decisão do criador, e a
-- razão é o espaço. Um minuto de vídeo de telemóvel são dezenas de MB, e o
-- plano tem 1 GB de Storage para tudo (as faturas incluídas).
--
-- ------------------------------------------------------------------
-- ONDE FICAM OS FICHEIROS
-- ------------------------------------------------------------------
-- Num bucket PRIVADO (`chat`), como os documentos e ao contrário da foto do
-- animal, que é base64 numa coluna. A regra é a mesma de sempre: a base de
-- dados tem 500 MB e é lida inteira pela app; o Storage tem 1 GB e serve-se
-- ficheiro a ficheiro, com ligações assinadas de prazo curto.
--
-- O caminho é `<conversa_id>/<mensagem_id>.<ext>`, e é a PRIMEIRA PASTA que a
-- RLS do bucket lê para decidir quem entra. Ver a secção 4.
--
-- ------------------------------------------------------------------
-- O PROBLEMA DE APAGAR
-- ------------------------------------------------------------------
-- Apagar a linha de `storage.objects` por SQL **não apaga o ficheiro**: o
-- Storage guarda os bytes fora da base, e quem os apaga é a API dele. Ou seja,
-- a limpeza dos seis meses (que corre no `pg_cron`, sem app nenhuma aberta)
-- consegue apagar as mensagens e não consegue apagar as fotografias delas.
--
-- A solução aqui é uma lista de espera: quando uma mensagem com anexo é
-- apagada — pelo autor ou pelo tempo — um gatilho escreve o caminho em
-- `anexo_orfao`. A APP, ao abrir, lê essa lista das suas conversas, manda o
-- Storage apagar os ficheiros e limpa as linhas. Não é imediato (depende de
-- alguém abrir a app), mas é o único caminho que não obriga a guardar a chave
-- de serviço da conta dentro da base de dados.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Colunas novas na mensagem
-- ------------------------------------------------------------------

alter table public.mensagem
  add column if not exists tipo text not null default 'texto';

alter table public.mensagem
  add column if not exists anexo text;

alter table public.mensagem
  add column if not exists anexo_tamanho integer;

/* Só no áudio: a duração, para o balão a mostrar antes de se carregar em tocar. */
alter table public.mensagem
  add column if not exists anexo_segundos integer;

/* Só na localização. */
alter table public.mensagem
  add column if not exists latitude double precision;

alter table public.mensagem
  add column if not exists longitude double precision;

do $$ begin
  alter table public.mensagem
    add constraint mensagem_tipo_conhecido
    check (tipo in ('texto', 'foto', 'audio', 'local'));
exception when duplicate_object then null; end $$;

-- O texto deixa de ser obrigatório em tudo o que não é texto: uma fotografia
-- pode ir sem legenda. A restrição antiga (`between 1 and 2000`) tinha de sair,
-- senão nenhuma fotografia entrava.
alter table public.mensagem drop constraint if exists mensagem_texto_check;

do $$ begin
  alter table public.mensagem
    add constraint mensagem_conteudo check (
      -- Uma mensagem APAGADA fica sem nada lá dentro (ver o gatilho da secção
      -- 2), e sem esta saída a restrição impedia apagá-la: uma fotografia sem
      -- ficheiro é inválida, e é isso que uma foto apagada passa a ser.
      apagada_em is not null or
      case tipo
        when 'texto' then char_length(btrim(texto)) between 1 and 2000
        when 'local' then latitude is not null and longitude is not null
                          and char_length(texto) <= 2000
        else anexo is not null and char_length(texto) <= 2000
      end
    );
exception when duplicate_object then null; end $$;

-- Um ficheiro só serve uma mensagem. Sem isto, duas mensagens podiam apontar
-- ao mesmo caminho e apagar uma deixava a outra sem imagem.
create unique index if not exists mensagem_anexo_unico
  on public.mensagem (anexo) where anexo is not null;


-- ------------------------------------------------------------------
-- 2. A lista de ficheiros à espera de serem apagados
-- ------------------------------------------------------------------
-- Ver o cabeçalho. `conversa_id` fica aqui SEM chave estrangeira de propósito:
-- se a exploração for apagada, a conversa vai com ela e esta linha tem de
-- sobreviver para o ficheiro ainda poder ser apagado.
--
-- (Nesse caso extremo ninguém a consegue ver — a RLS pergunta pela conversa,
-- que já não existe — e o ficheiro fica lá. É o único buraco conhecido desta
-- limpeza, e apagar uma exploração inteira não é coisa que aconteça a cada
-- bocado.)
create table if not exists public.anexo_orfao (
  caminho text primary key,
  conversa_id uuid not null,
  criado_em timestamptz not null default clock_timestamp()
);

create index if not exists idx_anexo_orfao_conversa
  on public.anexo_orfao (conversa_id);

alter table public.anexo_orfao enable row level security;

drop policy if exists anexo_orfao_select on public.anexo_orfao;
create policy anexo_orfao_select on public.anexo_orfao
  for select using (public.vi_conversa(conversa_id));

drop policy if exists anexo_orfao_delete on public.anexo_orfao;
create policy anexo_orfao_delete on public.anexo_orfao
  for delete using (public.vi_conversa(conversa_id));

-- Escrever é só por gatilho.
revoke insert, update on public.anexo_orfao from anon, authenticated;
revoke truncate, trigger, references on public.anexo_orfao from anon, authenticated;

-- Mensagem apagada (pelo autor) → o ficheiro entra na lista e a coluna limpa-se.
-- É um gatilho e não trabalho da app: assim o ficheiro nunca fica pendurado
-- numa mensagem que já não o mostra, mesmo que a app feche a meio.
create or replace function public.chat_anexo_ao_apagar()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if new.apagada_em is not null and old.apagada_em is null then
    if old.anexo is not null then
      insert into public.anexo_orfao (caminho, conversa_id)
      values (old.anexo, old.conversa_id)
      on conflict (caminho) do nothing;
    end if;
    -- Apagar apaga mesmo. A linha fica (a conversa dos outros não se
    -- reescreve) e a app mostra "Mensagem apagada" no lugar, mas o que lá
    -- estava sai da base: o texto, o caminho do ficheiro e as coordenadas.
    -- Sem isto, "apagada" era só uma etiqueta por cima do que continuava lá.
    new.anexo := null;
    new.anexo_tamanho := null;
    new.anexo_segundos := null;
    new.texto := '';
    new.latitude := null;
    new.longitude := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chat_anexo_apagada on public.mensagem;
create trigger trg_chat_anexo_apagada
  before update of apagada_em on public.mensagem
  for each row execute function public.chat_anexo_ao_apagar();

-- Mensagem eliminada (pelos seis meses) → o mesmo, pela outra porta.
create or replace function public.chat_anexo_ao_eliminar()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if old.anexo is not null then
    insert into public.anexo_orfao (caminho, conversa_id)
    values (old.anexo, old.conversa_id)
    on conflict (caminho) do nothing;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_chat_anexo_eliminada on public.mensagem;
create trigger trg_chat_anexo_eliminada
  before delete on public.mensagem
  for each row execute function public.chat_anexo_ao_eliminar();


-- ------------------------------------------------------------------
-- 3. O bucket
-- ------------------------------------------------------------------
-- PRIVADO, pela mesma razão do dos documentos: um bucket público serve os
-- ficheiros a quem souber o URL, e o URL de uma fotografia de uma conversa
-- privada só tem de escapar uma vez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat',
  'chat',
  false,
  -- 10 MB. Uma fotografia reduzida a 1200px anda nos 150-400 KB e um minuto de
  -- áudio a 32 kbps nos 250 KB: este teto é para travar o engano, não o uso.
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    -- Os quatro do áudio: o iOS grava `.m4a` (que às vezes se anuncia como
    -- `audio/mp4`), o Android `audio/mpeg` ou `.m4a`, e o navegador `webm`.
    'audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/webm'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ------------------------------------------------------------------
-- 4. RLS do bucket
-- ------------------------------------------------------------------
-- A pergunta é feita à PRIMEIRA PASTA do caminho, que é o id da conversa.
--
-- O `uuid_ou_nulo` existe porque um `::uuid` direto REBENTA quando o caminho
-- não é o esperado (um ficheiro posto à mão na raiz do bucket, por exemplo), e
-- uma política que rebenta não devolve "não": devolve erro em cima de qualquer
-- listagem do bucket, mesmo a de quem tem acesso a tudo o resto.
create or replace function public.uuid_ou_nulo(texto text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return texto::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists chat_bucket_read on storage.objects;
create policy chat_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat'
    and public.vi_conversa(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );

drop policy if exists chat_bucket_insert on storage.objects;
create policy chat_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat'
    and public.posso_escrever_na_conversa(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );

-- Apagar: só o que está na lista de espera, ou o que é meu. Sem a primeira
-- condição a limpeza não se fazia; sem a segunda, qualquer membro do grupo
-- podia apagar do bucket a fotografia que outro acabou de mandar, deixando-lhe
-- a mensagem sem imagem e sem explicação.
drop policy if exists chat_bucket_delete on storage.objects;
create policy chat_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat'
    and public.vi_conversa(public.uuid_ou_nulo((storage.foldername(name))[1]))
    and (
      exists (select 1 from public.anexo_orfao o where o.caminho = storage.objects.name)
      or exists (
        select 1 from public.mensagem m
         where m.anexo = storage.objects.name and m.autor = auth.uid()
      )
    )
  );


-- ------------------------------------------------------------------
-- 5. A lista de conversas passa a dizer o TIPO da última mensagem
-- ------------------------------------------------------------------
-- Refeita aqui e não no `schema_chat.sql` porque é aqui que a coluna `tipo`
-- nasce: uma função em `language sql` é validada quando se cria, e escrita lá
-- rebentava numa base onde este ficheiro ainda não tinha corrido.
--
-- Sem o tipo, a lista mostrava uma linha em branco por baixo do nome de quem
-- mandou uma fotografia sem legenda. Com ele, mostra "Fotografia".
drop function if exists public.minhas_conversas();

create or replace function public.minhas_conversas()
returns table (
  c_id uuid,
  c_tipo text,
  c_nome text,
  c_exploracao text,
  c_outro uuid,
  c_ultima_em timestamptz,
  c_ultimo_texto text,
  c_ultimo_genero text,
  c_ultimo_autor uuid,
  c_ultimo_apagado boolean,
  c_nao_lidas integer,
  c_silenciada boolean,
  c_ativa boolean
)
language sql security definer stable set search_path = 'public' as $$
  select c.id,
         c.tipo,
         c.nome,
         c.exploracao_id,
         case when c.tipo = 'privada'
              then case when c.par_a = auth.uid() then c.par_b else c.par_a end
         end,
         c.ultima_em,
         u.texto,
         -- `genero` e não `tipo`: a conversa já tem um `tipo` (grupo/privada) e
         -- duas colunas com o mesmo nome na mesma linha davam engano garantido.
         u.tipo,
         u.autor,
         (u.apagada_em is not null),
         coalesce(n.qtd, 0)::int,
         m.silenciada,
         (m.saiu_em is null)
    from public.conversa c
    join public.conversa_membro m
      on m.conversa_id = c.id and m.user_id = auth.uid()
    left join lateral (
      select x.texto, x.tipo, x.autor, x.apagada_em
        from public.mensagem x
       where x.conversa_id = c.id
         and x.criado_em >= m.entrou_em
         and (m.saiu_em is null or x.criado_em <= m.saiu_em)
       order by x.criado_em desc
       limit 1
    ) u on true
    left join lateral (
      select count(*) as qtd
        from public.mensagem y
       where y.conversa_id = c.id
         and y.criado_em > m.lido_ate
         and y.criado_em >= m.entrou_em
         and (m.saiu_em is null or y.criado_em <= m.saiu_em)
         and y.autor is distinct from auth.uid()
    ) n on true
   order by c.ultima_em desc;
$$;

revoke execute on function public.minhas_conversas() from anon, public;
grant execute on function public.minhas_conversas() to authenticated;


-- ------------------------------------------------------------------
-- 6. Denunciar uma FOTOGRAFIA
-- ------------------------------------------------------------------
-- A denúncia do `schema_chat.sql` copiava o `texto` da mensagem, o que chega
-- para uma mensagem escrita e não chega para nada quando o problema é a
-- imagem: uma fotografia ofensiva tem legenda vazia, e o que ia para a fila de
-- moderação era uma linha em branco.
--
-- Passa a levar o TIPO e o CAMINHO do ficheiro, e o superadmin passa a poder
-- abrir esse ficheiro (e só esse). É a mesma exceção do texto denunciado, pela
-- mesma razão: sem alguém a poder VER o que foi denunciado, o botão de
-- denunciar é teatro e a diretriz 1.2 da Apple não fica cumprida.

alter table public.mensagem_denuncia add column if not exists tipo text;
alter table public.mensagem_denuncia add column if not exists anexo text;

create or replace function public.denunciar_mensagem(msg uuid, motivo_txt text default null)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  m record;
  ctx jsonb;
begin
  select * into m from public.mensagem where id = msg;
  if m.id is null then
    raise exception 'mensagem não encontrada';
  end if;
  if not public.posso_ler_mensagem(m.conversa_id, m.criado_em) then
    raise exception 'sem acesso a esta mensagem';
  end if;
  if m.autor = auth.uid() then
    raise exception 'não faz sentido denunciar a própria mensagem';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'autor', a.autor, 'texto', a.texto, 'tipo', a.tipo, 'criado_em', a.criado_em
         ) order by a.criado_em), '[]'::jsonb)
    into ctx
    from (
      select autor, texto, tipo, criado_em
        from public.mensagem
       where conversa_id = m.conversa_id and criado_em < m.criado_em
       order by criado_em desc
       limit 3
    ) a;

  insert into public.mensagem_denuncia (
    mensagem_id, conversa_id, denunciado_por, autor_denunciado,
    texto_copia, tipo, anexo, contexto, motivo
  ) values (
    m.id, m.conversa_id, auth.uid(), m.autor,
    m.texto, m.tipo, m.anexo, ctx, nullif(btrim(coalesce(motivo_txt, '')), '')
  );
end;
$$;

revoke execute on function public.denunciar_mensagem(uuid, text) from anon, public;
grant execute on function public.denunciar_mensagem(uuid, text) to authenticated;

-- A leitura do bucket ganha a exceção do denunciado. Note-se o que ela NÃO é:
-- não dá ao superadmin o bucket todo, dá-lhe os ficheiros que alguém lhe
-- entregou ao carregar em "denunciar".
drop policy if exists chat_bucket_read on storage.objects;
create policy chat_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat'
    and (
      public.vi_conversa(public.uuid_ou_nulo((storage.foldername(name))[1]))
      or (
        public.eh_superadmin()
        and exists (
          select 1 from public.mensagem_denuncia d where d.anexo = storage.objects.name
        )
      )
    )
  );

-- E o ficheiro denunciado não desaparece antes de alguém o ver: enquanto a
-- denúncia estiver ABERTA, ele sai da lista de espera da limpeza. Assim que
-- for tratada, volta a entrar e o próximo arranque da app apaga-o.
drop policy if exists anexo_orfao_select on public.anexo_orfao;
create policy anexo_orfao_select on public.anexo_orfao
  for select using (
    public.vi_conversa(conversa_id)
    and not exists (
      select 1 from public.mensagem_denuncia d
       where d.anexo = anexo_orfao.caminho and d.estado = 'aberta'
    )
  );

drop policy if exists anexo_orfao_delete on public.anexo_orfao;
create policy anexo_orfao_delete on public.anexo_orfao
  for delete using (
    public.vi_conversa(conversa_id)
    and not exists (
      select 1 from public.mensagem_denuncia d
       where d.anexo = anexo_orfao.caminho and d.estado = 'aberta'
    )
  );


-- ------------------------------------------------------------------
-- 7. Privilégios
-- ------------------------------------------------------------------
-- As colunas novas entram no grant de inserção (a hora continua de fora, ver
-- o `schema_chat.sql`). O `apagada_em` também não: quem apaga é o update.
revoke insert on public.mensagem from authenticated;
grant insert (
  id, conversa_id, autor, texto,
  tipo, anexo, anexo_tamanho, anexo_segundos, latitude, longitude
) on public.mensagem to authenticated;

revoke execute on function public.uuid_ou_nulo(text) from anon, public;
grant execute on function public.uuid_ou_nulo(text) to authenticated;

revoke execute on function public.chat_anexo_ao_apagar() from anon, public, authenticated;
revoke execute on function public.chat_anexo_ao_eliminar() from anon, public, authenticated;


-- ------------------------------------------------------------------
-- 8. A API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. O bucket existe, é privado e aceita imagens e áudio:
--
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets
--    where id = 'chat';
--
-- 2. Uma mensagem de texto continua a exigir texto (tem de dar erro):
--
--   insert into public.mensagem (conversa_id, autor, texto) values ('<conv>', '<user>', '  ');
--
-- 3. Uma fotografia sem ficheiro também (tem de dar erro):
--
--   insert into public.mensagem (conversa_id, autor, texto, tipo)
--   values ('<conv>', '<user>', '', 'foto');
--
-- 4. Apagar uma mensagem com anexo põe o caminho na lista de espera:
--
--   update public.mensagem set apagada_em = now() where id = '<id>';
--   select * from public.anexo_orfao;
