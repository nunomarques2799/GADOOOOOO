import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar } from '@/data/avisos';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  type IconName,
  Screen,
  Text,
} from '@/components/ui';
import { csvFinancas, guardarFicheiro, hojeISO } from '@/data/exportar';
import {
  compararComAnterior,
  lancamentos,
  noPeriodo,
  porAnimal,
  PERIODOS,
  resumo,
  rotuloMovimento,
  serieMensal,
  vendasSemPreco,
  type Lancamento,
  type LinhaCategoria,
  type Periodo,
} from '@/data/financas';
import { formatDataCurta, formatEuro } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import type { CategoriaMovimento } from '@/data/types';
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

export default function FinancasScreen() {
  const router = useRouter();
  const { eventos, movimentos, animais, animalById } = useGado();
  const { podeVer, podeEmAlguma } = useMembros();

  const [periodo, setPeriodo] = useState<Periodo>('ano');

  // Sem `verFinancas` não há ecrã: quem só lança despesas não vê as contas da
  // exploração. O servidor já filtra o que chega (RLS), isto evita mostrar uma
  // soma parcial — meia conta é pior do que conta nenhuma, porque parece toda.
  const podeConsultar = podeVer(undefined, 'verFinancas');

  const todos = useMemo(() => lancamentos(eventos, movimentos), [eventos, movimentos]);
  const doPeriodo = useMemo(() => noPeriodo(todos, periodo), [todos, periodo]);
  const r = useMemo(() => resumo(doPeriodo), [doPeriodo]);
  const meses = useMemo(() => serieMensal(todos, 6), [todos]);
  const comparacao = useMemo(() => compararComAnterior(todos, periodo), [todos, periodo]);
  const ranking = useMemo(() => porAnimal(doPeriodo).slice(0, 5), [doPeriodo]);
  const porFechar = useMemo(() => vendasSemPreco(eventos, movimentos), [eventos, movimentos]);

  const positivo = r.saldo >= 0;
  const semDados = todos.length === 0;

  const nomeAnimal = (id: string) => {
    const a = animalById(id);
    return a?.nome ?? a?.numeroIdentificacao ?? 'Animal removido';
  };

  async function exportar() {
    try {
      await guardarFicheiro(
        `financas-${hojeISO()}.csv`,
        csvFinancas(doPeriodo, animais),
      );
    } catch (e) {
      avisar('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    }
  }

  if (!podeConsultar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Finanças" />
        <Screen>
          <EmptyState
            icon="lock-outline"
            title="Contas reservadas ao dono"
            message="As receitas e o balanço da exploração só podem ser consultados por quem a gere. Pode continuar a registar as despesas que fizer."
          />
          {podeEmAlguma('registarDespesa') ? (
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
      <Header title="Finanças" />
      <Screen>
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
                  onPress={() => setPeriodo(p.valor)}
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
                    Sem movimentos {periodo === 'mes' ? 'neste mês' : 'neste ano'}. Escolha
                    outro período para ver o histórico.
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
              Movimentos
            </Text>
            <Card padded={false} style={{ marginBottom: spacing.md }}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {r.movimentos.slice(0, 30).map((l, i) => (
                  <MovimentoRow
                    key={l.id}
                    lancamento={l}
                    nome={l.animalId ? nomeAnimal(l.animalId) : l.categoria}
                    divider={i < Math.min(r.movimentos.length, 30) - 1}
                  />
                ))}
              </View>
            </Card>

            <Button
              label="Registar movimento"
              icon="plus"
              onPress={() => router.push('/movimento/novo')}
              style={{ marginBottom: spacing.sm }}
            />
            <Button
              label="Exportar para Excel (CSV)"
              icon="file-download-outline"
              variant="secondary"
              onPress={exportar}
            />
            <Text
              variant="caption"
              color={colors.textMuted}
              style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              Exporta os movimentos do período escolhido.
            </Text>
          </>
        )}
      </Screen>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Peças do ecrã
 * ------------------------------------------------------------------ */

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
  const corVariacao = subiu === subirEBom ? colors.success : colors.danger;

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
              name={subiu ? 'arrow-up' : 'arrow-down'}
              size="xs"
              color={corVariacao}
            />
            <Text variant="caption" color={corVariacao}>
              {Math.abs(Math.round(variacao))}%
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
 */
function GraficoMeses({
  meses,
}: {
  meses: { chave: string; rotulo: string; receitas: number; despesas: number }[];
}) {
  const maximo = Math.max(...meses.map((m) => Math.max(m.receitas, m.despesas)), 1);
  const ALTURA = 96;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: ALTURA,
          gap: spacing.xs,
        }}>
        {meses.map((m) => (
          <View key={m.chave} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 3,
                height: ALTURA,
              }}>
              {/* `minHeight` de 3: um mês com pouco dinheiro tem de continuar a
                  ver-se. Sem isso, a barra desaparecia e lia-se como zero. */}
              <View
                style={{
                  width: 12,
                  height: Math.max((m.receitas / maximo) * ALTURA, m.receitas > 0 ? 3 : 0),
                  borderRadius: radii.sm,
                  backgroundColor: colors.success,
                }}
              />
              <View
                style={{
                  width: 12,
                  height: Math.max((m.despesas / maximo) * ALTURA, m.despesas > 0 ? 3 : 0),
                  borderRadius: radii.sm,
                  backgroundColor: colors.danger,
                }}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Eixo */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing.xs,
          marginTop: spacing.xs,
        }}>
        {meses.map((m) => (
          <Text
            key={m.chave}
            variant="caption"
            color={colors.textMuted}
            style={{ flex: 1, textAlign: 'center' }}>
            {m.rotulo}
          </Text>
        ))}
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
