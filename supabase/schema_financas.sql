-- ==================================================================
-- Gestão de Gado — gestão económica (v7)
-- ==================================================================
-- Aplica DEPOIS de schema.sql, schema_roles.sql e schema_versoes.sql.
-- Idempotente — pode correr-se mais do que uma vez.
--
-- Duas partes:
--
--   1. `evento.valor` — o CUSTO de um evento de animal (compra, vacina,
--      medicamento). Já existia; aqui só se garante a coluna.
--
--   2. `movimento` — tabela nova, para tudo o que um evento não sabe
--      guardar: a ração, a eletricidade, o gasóleo, as rendas... e TODAS
--      as receitas. Sem ela as finanças só contavam dinheiro preso a um
--      animal, e numa exploração de gado a alimentação costuma ser o maior
--      custo — o saldo aparecia positivo a quem estava a perder dinheiro.
--
-- PORQUE É QUE O PREÇO DE VENDA MUDA DE SÍTIO
-- O preço de uma venda era gravado em `evento.valor`. Mas o Postgres não
-- sabe mostrar uma coluna a uns membros da exploração e escondê-la a
-- outros: os grants de coluna são por papel de base de dados, e aqui toda
-- a gente é `authenticated`. Enquanto o preço vivesse no evento, qualquer
-- trabalhador ou veterinário que lesse a tabela via por quanto se venderam
-- os animais. Passa para `movimento`, onde a RLS por linha resolve o caso.
-- A secção 5 migra os valores que já lá estavam.
--
-- REGRAS DE ACESSO (espelhadas em src/data/permissoes.ts)
--   admin ......... vê e escreve tudo.
--   trabalhador ... lança DESPESAS; vê só as que ele próprio lançou.
--   veterinário ... não lança nem vê movimentos. O custo do tratamento
--                   que dá vai em `evento.valor`, que ele já podia escrever.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Custo nos eventos
-- ------------------------------------------------------------------
alter table public.evento
  add column if not exists valor numeric;

-- Um custo negativo não existe: o sentido vem do tipo do evento, não do sinal.
do $$ begin
  alter table public.evento add constraint evento_valor_positivo
    check (valor is null or valor >= 0);
exception when duplicate_object then null; end $$;


-- ------------------------------------------------------------------
-- 2. Tabela de movimentos
-- ------------------------------------------------------------------
create table if not exists public.movimento (
  id text primary key,
  exploracao_id text not null references public.exploracao (id) on delete cascade,
  direcao text not null check (direcao in ('receita', 'despesa')),
  categoria text not null,
  valor numeric not null check (valor > 0),
  data date not null,
  descricao text not null default '',
  contraparte text,
  -- Imputação opcional. `on delete set null`: apagar um animal não pode
  -- apagar a despesa — o dinheiro saiu na mesma e tem de continuar na conta.
  animal_id text references public.animal (id) on delete set null,
  terreno_id text references public.terreno (id) on delete set null,
  -- Quem lançou. É por esta coluna que a RLS deixa o trabalhador ver o que
  -- registou sem lhe abrir a contabilidade da exploração.
  criado_por uuid not null default auth.uid() references auth.users (id),
  criado_em timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_movimento_exploracao on public.movimento (exploracao_id);
create index if not exists idx_movimento_data on public.movimento (data);
create index if not exists idx_movimento_animal on public.movimento (animal_id);
create index if not exists idx_movimento_criado_por on public.movimento (criado_por);
create index if not exists idx_movimento_updated on public.movimento (updated_at);

-- Versão da linha, como nas outras tabelas (ver schema_versoes.sql).
drop trigger if exists trg_updated_at on public.movimento;
create trigger trg_updated_at before update on public.movimento
  for each row execute function public.toca_updated_at();


-- ------------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------------
alter table public.movimento enable row level security;

-- ---- Ler ----
-- O dono vê a exploração inteira. Os restantes veem apenas o que lançaram:
-- o suficiente para corrigirem um erro de digitação (450 € em vez de 45 €),
-- sem lhes dar as margens do negócio. Sem esta janela, um engano ficava lá
-- até o dono reparar nele.
drop policy if exists movimento_select on public.movimento;
create policy movimento_select on public.movimento
  for select using (
    public.eh_superadmin()
    or public.role_em(exploracao_id) = 'admin'
    or (public.membro_de(exploracao_id) and criado_por = auth.uid())
  );

-- ---- Criar ----
-- O admin lança o que quiser. O trabalhador só despesas, e sempre em nome
-- próprio: sem o `criado_por = auth.uid()` podia lançar em nome do dono e
-- escapar ao filtro de leitura acima.
drop policy if exists movimento_insert on public.movimento;
create policy movimento_insert on public.movimento
  for insert with check (
    public.eh_superadmin()
    or (
      public.perfil_ativo()
      and (
        public.role_em(exploracao_id) = 'admin'
        or (
          public.role_em(exploracao_id) = 'trabalhador'
          and direcao = 'despesa'
          and criado_por = auth.uid()
        )
      )
    )
  );

-- ---- Alterar ----
-- O trabalhador corrige o que lançou, e não pode transformá-lo em receita
-- nem passá-lo para o nome de outra pessoa.
drop policy if exists movimento_update on public.movimento;
create policy movimento_update on public.movimento
  for update using (
    public.eh_superadmin()
    or public.role_em(exploracao_id) = 'admin'
    or (public.role_em(exploracao_id) = 'trabalhador' and criado_por = auth.uid())
  ) with check (
    public.eh_superadmin()
    or (public.perfil_ativo() and public.role_em(exploracao_id) = 'admin')
    or (
      public.perfil_ativo()
      and public.role_em(exploracao_id) = 'trabalhador'
      and criado_por = auth.uid()
      and direcao = 'despesa'
    )
  );

-- ---- Apagar ----
-- Só o dono. Apagar dinheiro da conta é decisão de quem responde por ela.
drop policy if exists movimento_delete on public.movimento;
create policy movimento_delete on public.movimento
  for delete using (
    public.eh_superadmin() or public.role_em(exploracao_id) = 'admin'
  );


-- ------------------------------------------------------------------
-- 4. O veterinário não mexe em movimentos
-- ------------------------------------------------------------------
-- Já resulta das policies acima (nenhuma o inclui), mas fica dito: o custo
-- do que ele faz vai em `evento.valor`, coberto por `evento_maneio_write`.


-- ------------------------------------------------------------------
-- 5. Migração: preços de venda que estavam no evento
-- ------------------------------------------------------------------
-- Move o valor das vendas já registadas para `movimento` e limpa-o do
-- evento. Sem este passo, as receitas históricas desapareciam do ecrã
-- (`financas.ts` deixou de contar `valor` em eventos de Venda) e o
-- criador via o saldo cair sem explicação.
--
-- `where not exists` torna o passo repetível: correr o ficheiro duas vezes
-- não duplica receitas.
insert into public.movimento (
  id, exploracao_id, direcao, categoria, valor, data, descricao,
  animal_id, criado_por, criado_em
)
select
  'mig-' || e.id,
  a.exploracao_id,
  'receita',
  'Venda de animais',
  e.valor,
  e.data::date,
  coalesce(nullif(e.descricao, ''), 'Venda de animal'),
  e.animal_id,
  coalesce(
    (select m.user_id from public.membro_exploracao m
      where m.exploracao_id = a.exploracao_id and m.role = 'admin' limit 1),
    x.user_id
  ),
  now()
from public.evento e
join public.animal a on a.id = e.animal_id
join public.exploracao x on x.id = a.exploracao_id
where e.tipo = 'Venda'
  and e.valor is not null
  and e.valor > 0
  and not exists (
    select 1 from public.movimento mv where mv.id = 'mig-' || e.id
  );

-- Agora que o valor está no movimento, sai do evento — se ficasse, seria
-- contado duas vezes assim que alguém voltasse a somar as duas origens.
update public.evento e
   set valor = null
 where e.tipo = 'Venda'
   and e.valor is not null
   and exists (select 1 from public.movimento mv where mv.id = 'mig-' || e.id);


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- As cinco policies têm de aparecer:
--
--   select policyname, cmd from pg_policies
--    where tablename = 'movimento' order by policyname;
--
-- Nenhuma venda pode ficar com valor no evento:
--
--   select count(*) from public.evento where tipo = 'Venda' and valor is not null;
--
-- E as receitas migradas devem bater certo com o que lá estava:
--
--   select count(*), sum(valor) from public.movimento where id like 'mig-%';
