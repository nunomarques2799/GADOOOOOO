-- ==================================================================
-- Terrabovina — existências de medicamentos e vacinas
-- ==================================================================
-- Aplica DEPOIS de schema_reproducao.sql (30). Idempotente.
--
-- O QUE TRAZ
--
-- A tabela `medicamento` e duas colunas no `evento` que a ligam ao tratamento.
-- Até aqui a app registava que se deu um antibiótico a um animal e mais nada:
-- o frasco de onde ele saiu, o lote, a validade e quanto resta eram assunto de
-- um caderno na arrecadação. Ora o registo de medicamentos é obrigação legal em
-- Portugal, e o que a lei quer saber é exatamente isso — o que entrou, de que
-- lote, e onde foi parar.
--
-- UMA LINHA É UM LOTE COMPRADO, NÃO UM PRODUTO
--
-- Foi a decisão que decidiu o resto. Podia ser uma tabela de produtos
-- ("Penicilina") com uma quantidade a subir e a descer; é como se desenha um
-- armazém. Mas o registo de medicamentos é por LOTE: dois frascos do mesmo
-- antibiótico comprados com três meses de diferença têm lotes e validades
-- diferentes, e num surto é o lote que se rastreia, não o nome comercial.
--
-- Uma linha = um frasco (ou uma caixa) que entrou na exploração, com a
-- quantidade que trazia. Acabou? Fica lá, a zero, com o histórico do que se
-- deu a partir dele. Comprou-se outro? Linha nova. É como o criador pensa e é
-- o que a lei pede.
--
-- AS EXISTÊNCIAS NÃO SÃO UMA COLUNA
--
-- Não há `quantidade_atual` em lado nenhum: o que resta é a quantidade comprada
-- menos a soma do que os eventos gastaram (`evento.quantidade`). Uma coluna a
-- descontar obrigava a mantê-la certa a partir de dois sítios que podem estar
-- offline — e a primeira gravação perdida deixava-a errada para sempre, sem
-- ninguém saber a partir de quando. Calculada, é sempre igual à soma dos
-- registos, que é a única definição de "quanto resta" que se consegue defender
-- à frente de um inspetor.
--
-- QUEM MEXE NELA
--
--   ler ......... qualquer membro, VETERINÁRIO INCLUÍDO. Ele precisa de ver o
--                 que há na arrecadação para escolher o frasco que está a usar
--                 — sem isso ficava com uma caixa de texto e o stock nunca
--                 descia.
--   escrever .... `editarAnimais` (dono e trabalhador). Comprar e dar entrada
--                 de medicamento é gestão da exploração, não ato veterinário: o
--                 veterinário gasta do que lá está, não decide o que se compra.
--
-- Reparar na assimetria com o `evento`, que é de propósito: o veterinário
-- escreve o tratamento (e com ele o desconto no stock), mas não cria nem apaga
-- lotes.
--
-- O QUE ESTE FICHEIRO NÃO FAZ
--
-- Não liga o `medicamento` ao `registo_atividade` (schema_atividade.sql, 18). A
-- função `registar_atividade()` decide o resumo com um `if` por nome de tabela,
-- e acrescentar-lhe um ramo obrigava a recriar aqui a função inteira — duas
-- cópias de cem linhas para manter iguais, que é precisamente o modo de falhar
-- de que o `schema_agenda.sql` já avisa a propósito do `toca_updated_at`. Fica
-- por fazer, e fica escrito que está por fazer.
-- ==================================================================

create extension if not exists pgcrypto;


-- ------------------------------------------------------------------
-- 1. A tabela
-- ------------------------------------------------------------------
create table if not exists public.medicamento (
  id uuid primary key default gen_random_uuid(),
  exploracao_id text not null references public.exploracao (id) on delete cascade,
  criado_por uuid not null default auth.uid() references auth.users (id) on delete cascade,

  nome text not null,
  -- Vacina ou medicamento. Muda o sítio onde aparece (o formulário de vacinação
  -- não deve oferecer antibióticos) e mais nada.
  tipo text not null default 'Medicamento',
  lote text,
  -- `date` e não texto: é com ela que se ordena o que está prestes a expirar, e
  -- comparar datas escritas à mão dá a ordenação alfabética de "01/12" antes de
  -- "02/03".
  validade date,

  -- O que o frasco trazia. Positivo sempre: uma entrada de zero não é uma
  -- compra, é uma linha a mais na lista.
  quantidade numeric(10, 2) not null,
  unidade text not null default 'ml',

  -- Dias a aguardar antes de o animal poder ir para abate. Fica AQUI e não no
  -- evento porque é uma propriedade do produto — vem na bula, não da decisão de
  -- quem o administra. O formulário do tratamento propõe-o já preenchido e
  -- deixa corrigir, que é o que evita o erro mais caro desta app: vender para
  -- abate um animal ainda em intervalo de segurança.
  intervalo_seguranca_dias integer not null default 0,

  fornecedor text,
  -- Custo TOTAL do que entrou (não por unidade). Nulo quando não se sabe ou
  -- quando a gestão económica está desligada.
  custo numeric(10, 2),
  data_compra date not null default current_date,
  notas text,

  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.medicamento drop constraint if exists medicamento_nome_nao_vazio;
  alter table public.medicamento
    add constraint medicamento_nome_nao_vazio check (length(btrim(nome)) > 0);

  alter table public.medicamento drop constraint if exists medicamento_tipo_valido;
  alter table public.medicamento
    add constraint medicamento_tipo_valido check (tipo in ('Vacina', 'Medicamento'));

  alter table public.medicamento drop constraint if exists medicamento_quantidade_positiva;
  alter table public.medicamento
    add constraint medicamento_quantidade_positiva check (quantidade > 0);

  alter table public.medicamento drop constraint if exists medicamento_seguranca_nao_negativa;
  alter table public.medicamento
    add constraint medicamento_seguranca_nao_negativa check (intervalo_seguranca_dias >= 0);
end $$;

-- A lista é sempre "o que há nesta exploração", ordenado pelo que expira antes.
create index if not exists idx_medicamento_exploracao
  on public.medicamento (exploracao_id, validade);


-- ------------------------------------------------------------------
-- 2. A ligação ao tratamento
-- ------------------------------------------------------------------
-- `on delete set null` e não `cascade`: apagar um lote da arrecadação não pode
-- apagar o registo de que se deu aquele medicamento a um animal. O tratamento
-- aconteceu — o que se perde é a rastreabilidade do frasco, e isso é o preço de
-- apagar o frasco.
alter table public.evento
  add column if not exists medicamento_id uuid references public.medicamento (id) on delete set null;

-- Quanto se gastou, na unidade do lote. Nulo quando o tratamento não saiu de
-- nenhum lote registado (o veterinário que traz o seu), e é isso que faz o
-- desconto do stock ignorar essas linhas em vez de as contar como zero.
alter table public.evento
  add column if not exists quantidade numeric(10, 2);

do $$
begin
  alter table public.evento drop constraint if exists evento_quantidade_positiva;
  alter table public.evento
    add constraint evento_quantidade_positiva check (quantidade is null or quantidade > 0);
end $$;

-- O desconto do stock pergunta "que eventos saíram deste lote".
create index if not exists idx_evento_medicamento
  on public.evento (medicamento_id)
  where medicamento_id is not null;


-- ------------------------------------------------------------------
-- 3. Quem vê a arrecadação
-- ------------------------------------------------------------------
-- Membro da exploração, veterinário incluído — ao contrário da agenda e dos
-- documentos, que lhe estão fechados. A diferença é que isto é ferramenta de
-- trabalho dele: escolher o lote é parte de registar o tratamento.
--
-- `membro_de()` já deixa de fora quem tem o prazo esgotado.
create or replace function public.ve_medicamentos(exp_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_superadmin() or public.membro_de(exp_id);
$$;

revoke all     on function public.ve_medicamentos(text) from public, anon;
grant  execute on function public.ve_medicamentos(text) to authenticated;


-- ------------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------------
alter table public.medicamento enable row level security;

drop policy if exists medicamento_read on public.medicamento;
create policy medicamento_read on public.medicamento
  for select using (public.ve_medicamentos(exploracao_id));

-- `pode_cap` já traz lá dentro a conta suspensa e a exploração inativa.
drop policy if exists medicamento_insert on public.medicamento;
create policy medicamento_insert on public.medicamento
  for insert with check (
    criado_por = auth.uid()
    and public.pode_cap(exploracao_id, 'editarAnimais')
  );

drop policy if exists medicamento_update on public.medicamento;
create policy medicamento_update on public.medicamento
  for update
  using (public.pode_cap(exploracao_id, 'editarAnimais'))
  with check (public.pode_cap(exploracao_id, 'editarAnimais'));

-- Apagar um lote é raro e é para o engano — o normal é deixá-lo chegar a zero.
-- Fica com quem elimina animais, que é a mesma régua do resto do que se apaga.
drop policy if exists medicamento_delete on public.medicamento;
create policy medicamento_delete on public.medicamento
  for delete using (public.pode_cap(exploracao_id, 'eliminarAnimais'));


-- ------------------------------------------------------------------
-- 5. updated_at a cada alteração
-- ------------------------------------------------------------------
-- Reutiliza a função do `schema_versoes.sql`, recriada aqui para este ficheiro
-- correr sozinho. Tem de ficar IGUAL à de lá, `set search_path` incluído: um
-- `create or replace` sem a cláusula apaga-a da função existente e o aviso do
-- linter volta.
create or replace function public.toca_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists medicamento_updated_at on public.medicamento;
create trigger medicamento_updated_at
  before update on public.medicamento
  for each row execute function public.toca_updated_at();


-- ------------------------------------------------------------------
-- 6. Recarregar a cache do PostgREST
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- A tabela existe e está vazia:
--
--   select count(*) from public.medicamento;
--
-- As colunas novas do evento também:
--
--   select count(*) filter (where medicamento_id is not null) as de_lote,
--          count(*) as total
--     from public.evento;
--
-- Um lote e o que resta dele (é esta a conta que a app faz):
--
--   select m.nome, m.lote, m.quantidade, m.unidade,
--          m.quantidade - coalesce(sum(e.quantidade), 0) as resta
--     from public.medicamento m
--     left join public.evento e on e.medicamento_id = m.id
--    group by m.id
--    order by m.validade nulls last;
--
-- A RLS fecha a escrita ao veterinário e abre-lhe a leitura (correr como ele,
-- ver `gado-provar-rls-psql`):
--
--   set local role authenticated;
--   set local request.jwt.claims to '{"sub":"<uuid-do-veterinario>","role":"authenticated"}';
--   select count(*) from public.medicamento;                    -- vê
--   insert into public.medicamento (exploracao_id, nome, quantidade)
--     values ('<exp>', 'Teste', 100);                           -- recusado
