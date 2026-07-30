import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CartaoIntroducao } from '@/components/CartaoIntroducao';
import { avisar } from '@/data/avisos';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  type IconName,
  Screen,
  Text,
} from '@/components/ui';
import { descarregarTabelaExcel, excelDisponivel } from '@/data/excelFicheiro';
import { hojeISO, tabelaFinancas } from '@/data/exportar';
import {
  compararComAnterior,
  lancamentos,
  nomeMes,
  noPeriodo,
  porAnimal,
  PERIODOS,
  resumo,
  rotuloMovimento,
  serieMensal,
  vendasSemPreco,
  type BarraMes,
  type Lancamento,
  type LinhaCategoria,
  type Periodo,
} from '@/data/financas';
import { formatDataCurta, formatEuro } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useFinancas } from '@/data/useFinancas';
import type { CategoriaMovimento } from '@/data/types';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, radii, spacing } from '@/theme';

/** Ícone por categoria. Sem entrada = cai no ícone genérico de dinheiro. */
const ICONE_CATEGORIA: Partial<Record<CategoriaMovimento, IconName>> = {
  'Alimentação': 'silo',
  'Sanidade': 'needle',
  'Compra de animais': 'cart-outline',
  'Energia e combustível': 'lightning-bolt',
  'Água': 'water',
  'Rendas e terrenos': 'file-document-outline',
  'Máquinas e reparações': 'wrench-outline',
  'Mão-de-obra': 'account-hard-hat',
  'Taxas e seguros': 'shield-check-outline',
  'Outras despesas': 'dots-horizontal',
  'Venda de animais': 'cash-plus',
  'Leite e produtos': 'bottle-soda-outline',
  'Apoios e subsídios': 'hand-coin-outline',
  'Outras receitas': 'dots-horizontal',
};

function iconeDe(c: CategoriaMovimento): IconName {
  return ICONE_CATEGORIA[c] ?? 'cash';
}

/** Quantos movimentos a lista mostra de cada vez. */
const PAGINA_MOVIMENTOS = 30;

export default function FinancasScreen() {
  const router = useRouter();
  const { eventos, movimentos, animais, animalById, exploracoes } = useGado();
  const { controlo: controloAtualizar } = useAtualizarPuxando();
  const { podeVer } = useMembros();

  /** A exploração escolhida nos chips; `undefined` = todas as que se podem ver. */
  const [exploracaoId, setExploracaoId] = useState<string | undefined>(undefined);
  const [periodo, setPeriodo] = useState<Periodo>('ano');
  const [limite, setLimite] = useState(PAGINA_MOVIMENTOS);

  // A pergunta que decide se o ecrã ABRE continua a ser de conta ("em alguma
  // das minhas?"), e não da exploração escolhida. Se dependesse da escolha, uma
  // exploração sem contas para mostrar trocava o ecrã por um aviso — levando os
  // chips com ela, e deixando o criador sem forma de voltar atrás.
  const { ativas, podeVerFinancas, podeRegistarDespesa } = useFinancas();

  /**
   * As explorações cujas contas esta pessoa pode consultar. São as únicas que a
   * linha de chips oferece: um destino que abre fechado é pior do que nenhum.
   */
  const consultaveis = useMemo(
    () => exploracoes.filter((e) => podeVer(e.id, 'verFinancas')),
    [exploracoes, podeVer],
  );
  // Só vale a pena escolher com mais do que uma — com uma, a linha de chips não
  // decidia nada. Mesma regra do separador Animais.
  const podeEscolher = consultaveis.length > 1;

  /**
   * As explorações que entram nas contas.
   *
   * Escolhida uma, é essa. Sem escolha, são as que esta pessoa PODE consultar,
   * e não todas as que a app carregou: os movimentos já vêm filtrados por papel
   * (a RLS), mas os eventos com custo não vêm — quem é dono de uma exploração e
   * trabalhador de outra somava as duas no mesmo saldo, e um número que junta
   * dois negócios não são as contas de nenhum deles.
   */
  const filtro = useMemo(() => {
    // Um id que já não existe (a exploração foi eliminada noutro aparelho) volta
    // ao conjunto todo, em vez de deixar o ecrã vazio sem chip nenhum aceso.
    const escolhida = exploracaoId && consultaveis.some((e) => e.id === exploracaoId);
    return {
      exploracaoIds: escolhida ? [exploracaoId as string] : consultaveis.map((e) => e.id),
      animais,
    };
  }, [exploracaoId, consultaveis, animais]);

  /**
   * Tudo o que esta pessoa pode consultar, sem olhar aos chips. É o que decide
   * se o ecrã tem ou não conteúdo: se o "ainda sem movimentos" seguisse a
   * exploração escolhida, escolher uma quinta ainda sem lançamentos trocava o
   * ecrã pelo estado vazio — e levava os chips atrás, sem volta possível.
   */
  const daConta = useMemo(() => {
    const ids = consultaveis.map((e) => e.id);
    return lancamentos(eventos, movimentos, { exploracaoIds: ids, animais });
  }, [eventos, movimentos, consultaveis, animais]);

  const todos = useMemo(
    () => lancamentos(eventos, movimentos, filtro),
    [eventos, movimentos, filtro],
  );
  const doPeriodo = useMemo(() => noPeriodo(todos, periodo), [todos, periodo]);
  const r = useMemo(() => resumo(doPeriodo), [doPeriodo]);
  const meses = useMemo(() => serieMensal(todos, 6), [todos]);
  const comparacao = useMemo(() => compararComAnterior(todos, periodo), [todos, periodo]);
  const ranking = useMemo(() => porAnimal(doPeriodo).slice(0, 5), [doPeriodo]);
  const porFechar = useMemo(
    () => vendasSemPreco(eventos, movimentos, filtro),
    [eventos, movimentos, filtro],
  );

  const positivo = r.saldo >= 0;
  const semDados = daConta.length === 0;
  const nomeExploracao = consultaveis.find((e) => e.id === exploracaoId)?.nome;
  const visiveis = r.movimentos.slice(0, limite);
  const porMostrar = r.movimentos.length - visiveis.length;

  /** Muda de exploração e volta a lista de movimentos ao início. */
  function escolherExploracao(id: string | undefined) {
    setExploracaoId(id);
    setLimite(PAGINA_MOVIMENTOS);
  }

  const nomeAnimal = (id: string) => {
    const a = animalById(id);
    return a?.nome ?? a?.numeroIdentificacao ?? 'Animal removido';
  };

  function exportar() {
    try {
      descarregarTabelaExcel(
        `financas-${hojeISO()}.xlsx`,
        'Movimentos',
        tabelaFinancas(doPeriodo, animais),
      );
    } catch (e) {
      avisar('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    }
  }

  // Duas razões diferentes para não haver ecrã, e cada uma merece a sua
  // explicação: ou a conta não usa a app para contas, ou usa mas isto não é
  // assunto de quem está a ver. Uma mensagem genérica deixava o trabalhador a
  // pensar que estava sem permissões quando o dono é que desligou tudo.
  if (!ativas) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen topInset>
          <TituloFinancas legenda="Despesas, receitas e o saldo da exploração" />
          <EmptyState
            icon="cash-off"
            title="Gestão financeira desligada"
            message="Esta conta não usa a app para registar despesas e receitas. Quem gere a exploração pode ligá-la em Perfil → Gestão financeira."
          />
        </Screen>
      </View>
    );
  }

  if (!podeVerFinancas) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen topInset>
          <TituloFinancas legenda="Despesas, receitas e o saldo da exploração" />
          <EmptyState
            icon="lock-outline"
            title="Contas reservadas ao dono"
            message="As receitas e o balanço da exploração só podem ser consultados por quem a gere. Pode continuar a registar as despesas que fizer."
          />
          {podeRegistarDespesa ? (
            <Button
              label="Registar despesa"
              icon="cash-minus"
              onPress={() => router.push('/movimento/novo')}
            />
          ) : null}
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen topInset refreshControl={controloAtualizar}>
        <TituloFinancas legenda="Despesas, receitas e o saldo da exploração" />

        {/* À primeira vez, o que é este separador. Não se mostra nos dois casos
            acima (finanças desligadas, contas reservadas ao dono): explicar com
            calma o que é isto a quem não o pode usar é gastar a única vez em
            que o cartão aparece. */}
        <View style={{ marginBottom: spacing.md }}>
          <CartaoIntroducao
            chave="financas"
            icon="cash-multiple"
            titulo="Para que serve este separador"
            pontos={[
              'Aqui aponta o que gasta (ração, veterinário, rendas) e o que recebe (vendas, leite, subsídios). A app faz a conta e mostra-lhe o saldo.',
              'Cada despesa pode ficar ligada a um animal ou a um terreno — é assim que depois se sabe quanto custou cada um.',
              'Os totais em cima são do período que escolher; com mais do que uma exploração, escolha primeiro qual.',
              'O dinheiro é opcional e pode desligá-lo em Perfil → Gestão financeira. Desligar esconde, não apaga.',
            ]}
          />
        </View>

        {semDados ? (
          <>
            <EmptyState
              icon="cash-multiple"
              title="Ainda sem movimentos"
              message="Registe o que gasta em ração, energia ou vacinas, e o que recebe das vendas. O resumo aparece aqui."
            />
            <Button
              label="Registar movimento"
              icon="plus"
              onPress={() => router.push('/movimento/novo')}
            />
          </>
        ) : (
          <>
            {/* Exploração — com duas quintas, um saldo que soma as duas não são
                as contas de nenhuma delas. Fica à vista, como em Animais e
                Alertas, e não escondido atrás de um botão de filtros. */}
            {podeEscolher ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.xs,
                  marginBottom: spacing.sm,
                }}>
                <Chip
                  label="Todas"
                  icon="barn"
                  selected={exploracaoId === undefined}
                  onPress={() => escolherExploracao(undefined)}
                />
                {consultaveis.map((e) => (
                  <Chip
                    key={e.id}
                    label={e.nome}
                    selected={exploracaoId === e.id}
                    onPress={() =>
                      escolherExploracao(exploracaoId === e.id ? undefined : e.id)
                    }
                  />
                ))}
              </View>
            ) : null}

            {/* Período — muda tudo o que está abaixo */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.xs,
                marginBottom: spacing.md,
              }}>
              {PERIODOS.map((p) => (
                <Chip
                  key={p.valor}
                  label={p.label}
                  selected={periodo === p.valor}
                  onPress={() => {
                    setPeriodo(p.valor);
                    setLimite(PAGINA_MOVIMENTOS);
                  }}
                />
              ))}
            </View>

            {/* Um período sem nada registado tem de o dizer. Sem esta linha o
                ecrã ficava só com os separadores e um saldo a zero, e lia-se
                como avaria em vez de "não houve movimentos neste mês". */}
            {doPeriodo.length === 0 ? (
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="calendar-blank" size="lg" color={colors.textMuted} />
                  <Text variant="body" style={{ flex: 1 }}>
                    Sem movimentos {periodo === 'mes' ? 'neste mês' : 'neste ano'}
                    {nomeExploracao ? ` em ${nomeExploracao}` : ''}. Escolha outro período
                    {podeEscolher ? ' ou outra exploração' : ''} para ver o histórico.
                  </Text>
                </View>
              </Card>
            ) : null}

            {/* Vendas por fechar — antes dos números, porque explica-os */}
            {porFechar.length > 0 ? (
              <Pressable
                onPress={() => router.push(`/animal/${porFechar[0].animalId}`)}
                accessibilityRole="button">
                <Card
                  style={{ backgroundColor: colors.warningTint, marginBottom: spacing.md }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Icon name="tag-off-outline" size="lg" color={colors.warning} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">
                        {porFechar.length}{' '}
                        {porFechar.length === 1 ? 'venda sem preço' : 'vendas sem preço'}
                      </Text>
                      <Text variant="secondary" color={colors.textSecondary}>
                        Alguém registou a saída do animal mas não o valor. As receitas
                        abaixo estão incompletas até as fechar.
                      </Text>
                    </View>
                    <Icon name="chevron-right" size="md" color={colors.textMuted} />
                  </View>
                </Card>
              </Pressable>
            ) : null}

            {/* Saldo */}
            <Card
              style={{
                backgroundColor: positivo ? colors.successTint : colors.dangerTint,
                marginBottom: spacing.md,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon
                  name={positivo ? 'trending-up' : 'trending-down'}
                  size="lg"
                  color={positivo ? colors.success : colors.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="secondary" color={colors.textSecondary}>
                    Saldo (receitas − despesas)
                  </Text>
                  <Text
                    variant="display"
                    color={positivo ? colors.success : colors.danger}>
                    {formatEuro(r.saldo)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Receitas / Despesas, com a variação face ao período anterior */}
            <View
              style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <TotalCard
                icon="arrow-down-bold-circle"
                label="Receitas"
                valor={r.receitas}
                cor={colors.success}
                variacao={comparacao.disponivel ? comparacao.variacaoReceitas : undefined}
                subirEBom
              />
              <TotalCard
                icon="arrow-up-bold-circle"
                label="Despesas"
                valor={r.despesas}
                cor={colors.danger}
                variacao={comparacao.disponivel ? comparacao.variacaoDespesas : undefined}
                subirEBom={false}
              />
            </View>

            {/* Evolução mensal */}
            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              Últimos 6 meses
            </Text>
            <Card style={{ marginBottom: spacing.md }}>
              <GraficoMeses meses={meses} />
            </Card>

            {/* Para onde vai o dinheiro */}
            {r.categoriasDespesa.length > 0 ? (
              <>
                <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                  Para onde vai o dinheiro
                </Text>
                <Card padded={false} style={{ marginBottom: spacing.md }}>
                  <View style={{ paddingHorizontal: spacing.md }}>
                    {r.categoriasDespesa.map((c, i) => (
                      <BarraCategoria
                        key={c.categoria}
                        linha={c}
                        divider={i < r.categoriasDespesa.length - 1}
                      />
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {/* De onde vem */}
            {r.categoriasReceita.length > 0 ? (
              <>
                <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                  De onde vem o dinheiro
                </Text>
                <Card padded={false} style={{ marginBottom: spacing.md }}>
                  <View style={{ paddingHorizontal: spacing.md }}>
                    {r.categoriasReceita.map((c, i) => (
                      <BarraCategoria
                        key={c.categoria}
                        linha={c}
                        divider={i < r.categoriasReceita.length - 1}
                      />
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {/* Por animal */}
            {ranking.length > 0 ? (
              <>
                <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                  Animais que mais pesam
                </Text>
                <Card padded={false} style={{ marginBottom: spacing.md }}>
                  <View style={{ paddingHorizontal: spacing.md }}>
                    {ranking.map((l, i) => (
                      <Pressable
                        key={l.animalId}
                        onPress={() => router.push(`/animal/${l.animalId}`)}
                        accessibilityRole="button">
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.sm,
                            paddingVertical: spacing.sm,
                            borderBottomWidth: i < ranking.length - 1 ? 1 : 0,
                            borderBottomColor: colors.border,
                          }}>
                          <Icon name="cow" size="md" color={colors.primary} />
                          <View style={{ flex: 1 }}>
                            <Text variant="bodyStrong" numberOfLines={1}>
                              {nomeAnimal(l.animalId)}
                            </Text>
                            <Text variant="secondary" color={colors.textMuted}>
                              {/* "Custou 0 €" não é informação — é ruído. Um
                                  animal comprado antes de haver registos só
                                  tem a venda, e é isso que se deve ler. */}
                              {l.custos > 0
                                ? `Custou ${formatEuro(l.custos, 0)}${
                                    l.receita > 0 ? ` · rendeu ${formatEuro(l.receita, 0)}` : ''
                                  }`
                                : `Rendeu ${formatEuro(l.receita, 0)}`}
                            </Text>
                          </View>
                          {l.receita > 0 ? (
                            <Text
                              variant="bodyStrong"
                              color={l.resultado >= 0 ? colors.success : colors.danger}>
                              {l.resultado >= 0 ? '+' : '−'}
                              {formatEuro(Math.abs(l.resultado), 0)}
                            </Text>
                          ) : (
                            <Text variant="bodyStrong" color={colors.danger}>
                              −{formatEuro(l.custos, 0)}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {/* Movimentos */}
            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              Movimentos ({r.movimentos.length})
            </Text>
            <Card padded={false} style={{ marginBottom: spacing.md }}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {visiveis.map((l, i) => (
                  <MovimentoRow
                    key={l.id}
                    lancamento={l}
                    nome={l.animalId ? nomeAnimal(l.animalId) : l.categoria}
                    divider={i < visiveis.length - 1}
                  />
                ))}
              </View>
            </Card>
            {/* A lista parava nos 30 sem o dizer: quem tinha mais histórico não
                tinha como chegar ao resto a não ser exportando para Excel. */}
            {porMostrar > 0 ? (
              <Button
                label={
                  porMostrar <= PAGINA_MOVIMENTOS
                    ? `Ver os últimos ${porMostrar}`
                    : `Ver mais ${PAGINA_MOVIMENTOS} (faltam ${porMostrar})`
                }
                icon="chevron-down"
                variant="secondary"
                onPress={() => setLimite((n) => n + PAGINA_MOVIMENTOS)}
                style={{ marginBottom: spacing.md }}
              />
            ) : null}

            <Button
              label="Registar movimento"
              icon="plus"
              onPress={() => router.push('/movimento/novo')}
              style={{ marginBottom: spacing.sm }}
            />
            {/* Quem lançou o quê, e quando. A lista acima ordena-se pela data
                da fatura; esta pela hora a que a linha entrou na app, que é a
                pergunta que se faz quando há mais do que uma pessoa a lançar. */}
            <Button
              label="Histórico de registos"
              icon="history"
              variant="secondary"
              onPress={() => router.push('/movimento/historico')}
              style={{ marginBottom: spacing.sm }}
            />
            {/* Sem disco onde escrever o .xlsx (telemóvel) não se mostra o botão. */}
            {excelDisponivel ? (
              <>
                <Button
                  label="Exportar para Excel"
                  icon="microsoft-excel"
                  variant="secondary"
                  onPress={exportar}
                />
                <Text
                  variant="caption"
                  color={colors.textMuted}
                  style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                  Exporta o que está a ver: o período{nomeExploracao ? ` e ${nomeExploracao}` : ''}.
                </Text>
              </>
            ) : (
              <Text
                variant="caption"
                color={colors.textMuted}
                style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                Exportar as contas para Excel faz-se na app de computador.
              </Text>
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Peças do ecrã
 * ------------------------------------------------------------------ */

/**
 * O título do separador, igual ao dos outros.
 *
 * Estava um `<Header>` aqui — o cabeçalho dos ecrãs de detalhe, com botão de
 * voltar e título pequeno ao centro. Num separador não há para onde voltar, e
 * ao lado de "Animais" ou "Terrenos", que são títulos grandes encostados à
 * esquerda, as Finanças liam-se como um ecrã de outra app.
 */
function TituloFinancas({ legenda }: { legenda: string }) {
  return (
    <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
      <Text variant="display">Finanças</Text>
      <Text variant="body" color={colors.textSecondary}>
        {legenda}
      </Text>
    </View>
  );
}

function TotalCard({
  icon,
  label,
  valor,
  cor,
  variacao,
  subirEBom,
}: {
  icon: IconName;
  label: string;
  valor: number;
  cor: string;
  variacao?: number;
  subirEBom: boolean;
}) {
  // Uma despesa a subir é má notícia, uma receita a subir é boa: a cor da seta
  // segue o que aquilo significa para o criador, não o sinal do número.
  const subiu = (variacao ?? 0) > 0;
  // Zero é "igual ao período anterior", e não merece cor nenhuma. Sem esta
  // exceção, uma receita que se manteve saía com uma seta para baixo VERMELHA a
  // dizer 0% — a leitura era de queda, exatamente onde não houve queda nenhuma.
  // O teste é sobre a percentagem ARREDONDADA, que é a que aparece: meio por
  // cento de subida também sai "0%", e uma seta ao lado de um zero não diz nada.
  const igual = variacao !== undefined && Math.round(variacao) === 0;
  const corVariacao = igual
    ? colors.textMuted
    : subiu === subirEBom
      ? colors.success
      : colors.danger;

  return (
    <Card style={{ flex: 1 }} padded={false}>
      <View style={{ padding: spacing.md, gap: spacing.xxs }}>
        <Icon name={icon} size="md" color={cor} />
        <Text variant="h2" color={cor} style={{ marginTop: 2 }}>
          {formatEuro(valor, 0)}
        </Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {label}
        </Text>
        {variacao !== undefined ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon
              name={igual ? 'equal' : subiu ? 'arrow-up' : 'arrow-down'}
              size="xs"
              color={corVariacao}
            />
            <Text variant="caption" color={corVariacao}>
              {igual ? 'igual' : `${Math.abs(Math.round(variacao))}%`}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Barras mensais de receitas e despesas, lado a lado.
 *
 * Desenhado com Views em vez de uma biblioteca de gráficos: são duas barras
 * por mês, e uma dependência nova custaria mais ao arranque da app do que isto
 * custa a manter. As alturas são relativas ao maior valor da série.
 *
 * OS NÚMEROS TÊM DE APARECER. Só com as barras, o gráfico dizia a forma (subiu,
 * desceu) e não dizia dinheiro nenhum: duas barras de alturas parecidas podiam
 * ser 200 € ou 2 000 €, e a única maneira de saber era somar os lançamentos à
 * mão. Agora aparecem em dois sítios, e não por indecisão:
 *
 *   - a linha de cima mostra os valores EXATOS de um mês (o atual, ou aquele em
 *     que se tocar). É a que funciona sempre — em ecrã estreito e com a letra
 *     do sistema ampliada ao máximo;
 *   - por cima de cada barra, em janelas largas, onde há espaço para os doze
 *     números. No telemóvel não há: "5 725 €" ao lado de outro igual, em 50 px,
 *     saía por cima do vizinho ou cortado a meio.
 */
function GraficoMeses({ meses }: { meses: BarraMes[] }) {
  const desktop = useDesktop();
  const [escolhido, setEscolhido] = useState<string | undefined>(undefined);

  const maximo = Math.max(...meses.map((m) => Math.max(m.receitas, m.despesas)), 1);
  const ALTURA = 96;
  /** Espaço para o número por cima da barra mais alta. */
  const TOPO = desktop ? 20 : 0;

  // Por omissão, o mês em curso: é o que o criador está a viver, e é o que ele
  // vem cá ver. Tocar num mês passa o foco para esse.
  const foco = meses.find((m) => m.chave === escolhido) ?? meses[meses.length - 1];
  if (!foco) return null;

  return (
    <View>
      {/* Os valores exatos do mês em foco */}
      <View style={{ marginBottom: spacing.sm }}>
        <Text variant="bodyStrong">{nomeMes(foco.chave)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: 2 }}>
          {foco.receitas === 0 && foco.despesas === 0 ? (
            <Text variant="secondary" color={colors.textSecondary}>
              Sem registos neste mês.
            </Text>
          ) : (
            <>
              <ValorMes label="Receitas" valor={foco.receitas} cor={colors.success} />
              <ValorMes label="Despesas" valor={foco.despesas} cor={colors.danger} />
              <ValorMes
                label="Saldo"
                valor={foco.saldo}
                cor={foco.saldo < 0 ? colors.danger : colors.success}
                comSinal
              />
            </>
          )}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: spacing.xs,
        }}>
        {meses.map((m) => {
          const emFoco = m.chave === foco.chave;
          return (
            <Pressable
              key={m.chave}
              onPress={() => setEscolhido(m.chave)}
              accessibilityRole="button"
              // Lido em voz alta com os números: um gráfico é invisível para
              // quem usa leitor de ecrã, e este é o único sítio onde eles estão.
              accessibilityLabel={`${nomeMes(m.chave)}: receitas ${formatEuro(
                m.receitas,
                0,
              )}, despesas ${formatEuro(m.despesas, 0)}`}
              accessibilityState={{ selected: emFoco }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  alignItems: 'center',
                  paddingTop: spacing.xxs,
                  borderRadius: radii.sm,
                  backgroundColor: emFoco ? colors.surfaceSunken : 'transparent',
                },
                pressed && { opacity: 0.6 },
              ]}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  gap: 3,
                  height: ALTURA + TOPO,
                }}>
                {/* `minHeight` de 3: um mês com pouco dinheiro tem de continuar a
                    ver-se. Sem isso, a barra desaparecia e lia-se como zero. */}
                <Barra
                  valor={m.receitas}
                  altura={Math.max((m.receitas / maximo) * ALTURA, m.receitas > 0 ? 3 : 0)}
                  cor={colors.success}
                  comNumero={desktop}
                />
                <Barra
                  valor={m.despesas}
                  altura={Math.max((m.despesas / maximo) * ALTURA, m.despesas > 0 ? 3 : 0)}
                  cor={colors.danger}
                  comNumero={desktop}
                />
              </View>
              <Text
                variant="caption"
                color={emFoco ? colors.text : colors.textMuted}
                style={{ marginTop: spacing.xxs }}>
                {m.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Legenda — a cor sozinha não chega (daltonismo, ecrã ao sol) */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          marginTop: spacing.sm,
          justifyContent: 'center',
        }}>
        <Legenda cor={colors.success} label="Receitas" />
        <Legenda cor={colors.danger} label="Despesas" />
      </View>

      {meses.length > 1 ? (
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ textAlign: 'center', marginTop: spacing.xs }}>
          Toque num mês para ver os valores desse mês.
        </Text>
      ) : null}
    </View>
  );
}

/** Uma barra, com o valor por cima quando há largura para ele. */
function Barra({
  valor,
  altura,
  cor,
  comNumero,
}: {
  valor: number;
  altura: number;
  cor: string;
  comNumero: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
      {comNumero && valor > 0 ? (
        // Sem cêntimos: o gráfico é para comparar meses, e "5 725,40 €" só rouba
        // largura ao vizinho. Os cêntimos estão na lista de lançamentos.
        <Text variant="caption" color={cor} numberOfLines={1} style={{ marginBottom: 2 }}>
          {formatEuro(valor, 0)}
        </Text>
      ) : null}
      <View style={{ width: 12, height: altura, borderRadius: radii.sm, backgroundColor: cor }} />
    </View>
  );
}

/** "Receitas / 1 250 €" — um dos três números do mês em foco. */
function ValorMes({
  label,
  valor,
  cor,
  comSinal,
}: {
  label: string;
  valor: number;
  cor: string;
  /** O saldo mostra-se com sinal; receitas e despesas não precisam dele. */
  comSinal?: boolean;
}) {
  return (
    <View>
      <Text variant="caption" color={colors.textMuted}>
        {label.toUpperCase()}
      </Text>
      <Text variant="bodyStrong" color={cor}>
        {comSinal && valor > 0 ? '+' : ''}
        {formatEuro(valor, 0)}
      </Text>
    </View>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: cor }} />
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

/** Linha de categoria com barra de proporção — responde a "onde gasto mais". */
function BarraCategoria({ linha, divider }: { linha: LinhaCategoria; divider: boolean }) {
  const cor = linha.direcao === 'receita' ? colors.success : colors.danger;
  return (
    <View
      style={{
        paddingVertical: spacing.sm,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
        gap: 6,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={iconeDe(linha.categoria)} size="md" color={cor} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{linha.categoria}</Text>
          <Text variant="secondary" color={colors.textMuted}>
            {linha.contagem} {linha.contagem === 1 ? 'registo' : 'registos'} ·{' '}
            {Math.round(linha.percentagem)}%
          </Text>
        </View>
        <Text variant="bodyStrong" color={cor}>
          {linha.direcao === 'receita' ? '+' : '−'}
          {formatEuro(linha.total, 0)}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceSunken,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${Math.max(linha.percentagem, 2)}%`,
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: cor,
          }}
        />
      </View>
    </View>
  );
}

function MovimentoRow({
  lancamento,
  nome,
  divider,
}: {
  lancamento: Lancamento;
  nome: string;
  divider: boolean;
}) {
  const receita = lancamento.direcao === 'receita';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: receita ? colors.successTint : colors.dangerTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon
          name={iconeDe(lancamento.categoria)}
          size="sm"
          color={receita ? colors.success : colors.danger}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {lancamento.descricao || nome}
        </Text>
        <Text variant="secondary" color={colors.textMuted} numberOfLines={1}>
          {lancamento.categoria} · {formatDataCurta(lancamento.data)}
        </Text>
      </View>
      <Text variant="bodyStrong" color={receita ? colors.success : colors.danger}>
        {rotuloMovimento(lancamento)}
      </Text>
    </View>
  );
}
