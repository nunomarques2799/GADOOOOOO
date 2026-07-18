import { View } from 'react-native';

import { avisar } from '@/data/avisos';
import { Button, Card, EmptyState, Header, Icon, type IconName, Screen, Text } from '@/components/ui';
import {
  csvFinancas,
  guardarFicheiro,
  hojeISO,
} from '@/data/exportar';
import {
  direcaoDoEvento,
  resumoFinanceiro,
  rotuloMovimento,
  type CategoriaFinanceira,
} from '@/data/financas';
import { formatDataCurta, formatEuro } from '@/data/helpers';
import { useGado } from '@/data/store';
import type { Evento } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

/** Ícone e cor por categoria de dinheiro. */
const CAT_META: Record<CategoriaFinanceira, { icon: IconName; cor: string }> = {
  Vendas: { icon: 'cash-plus', cor: colors.success },
  Compras: { icon: 'cart-outline', cor: colors.danger },
  Vacinação: { icon: 'needle', cor: colors.danger },
  Medicamentos: { icon: 'medical-bag', cor: colors.danger },
};

export default function FinancasScreen() {
  const { eventos, animais, animalById } = useGado();
  const resumo = resumoFinanceiro(eventos);
  const positivo = resumo.saldo >= 0;

  const nomeAnimal = (id: string) => {
    const a = animalById(id);
    return a?.nome ?? a?.numeroIdentificacao ?? 'Animal removido';
  };

  async function exportar() {
    try {
      await guardarFicheiro(`financas-${hojeISO()}.csv`, csvFinancas(eventos, animais));
    } catch (e) {
      avisar('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    }
  }

  const semDados = resumo.movimentos.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Finanças" />
      <Screen>
        {semDados ? (
          <EmptyState
            icon="cash-multiple"
            title="Ainda sem movimentos"
            message="Os valores aparecem aqui quando registar o preço de uma venda, ou o custo de vacinas e medicamentos."
          />
        ) : (
          <>
            {/* Saldo — cartão de destaque */}
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
                  <Text variant="display" color={positivo ? colors.success : colors.danger}>
                    {formatEuro(resumo.saldo)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Receitas / Despesas lado a lado */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <TotalCard
                icon="arrow-down-bold-circle"
                label="Receitas"
                valor={resumo.receitas}
                cor={colors.success}
              />
              <TotalCard
                icon="arrow-up-bold-circle"
                label="Despesas"
                valor={resumo.despesas}
                cor={colors.danger}
              />
            </View>

            {/* Por categoria */}
            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              Por categoria
            </Text>
            <Card padded={false} style={{ marginBottom: spacing.md }}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {resumo.categorias.map((c, i) => {
                  const meta = CAT_META[c.categoria];
                  return (
                    <View
                      key={c.categoria}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.sm,
                        borderBottomWidth: i < resumo.categorias.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}>
                      <Icon name={meta.icon} size="md" color={meta.cor} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{c.categoria}</Text>
                        <Text variant="secondary" color={colors.textMuted}>
                          {c.contagem} {c.contagem === 1 ? 'registo' : 'registos'}
                        </Text>
                      </View>
                      <Text
                        variant="bodyStrong"
                        color={c.direcao === 'receita' ? colors.success : colors.danger}>
                        {c.direcao === 'receita' ? '+' : '−'}
                        {formatEuro(c.total, 0)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Movimentos recentes */}
            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              Movimentos
            </Text>
            <Card padded={false} style={{ marginBottom: spacing.md }}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {resumo.movimentos.map((e, i) => (
                  <MovimentoRow
                    key={e.id}
                    evento={e}
                    nome={nomeAnimal(e.animalId)}
                    divider={i < resumo.movimentos.length - 1}
                  />
                ))}
              </View>
            </Card>

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
              Inclui o preço das vendas e o custo de vacinas e medicamentos que registar.
            </Text>
          </>
        )}
      </Screen>
    </View>
  );
}

function TotalCard({
  icon,
  label,
  valor,
  cor,
}: {
  icon: IconName;
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <Card style={{ flex: 1 }} padded={false}>
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <Icon name={icon} size="md" color={cor} />
        <Text variant="h2" color={cor} style={{ marginTop: 2 }}>
          {formatEuro(valor, 0)}
        </Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {label}
        </Text>
      </View>
    </Card>
  );
}

function MovimentoRow({
  evento,
  nome,
  divider,
}: {
  evento: Evento;
  nome: string;
  divider: boolean;
}) {
  const receita = direcaoDoEvento(evento.tipo) === 'receita';
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
        <Icon name={receita ? 'cash-plus' : 'cash-minus'} size="sm" color={receita ? colors.success : colors.danger} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {nome}
        </Text>
        <Text variant="secondary" color={colors.textMuted}>
          {evento.tipo} · {formatDataCurta(evento.data)}
        </Text>
      </View>
      <Text variant="bodyStrong" color={receita ? colors.success : colors.danger}>
        {rotuloMovimento(evento)}
      </Text>
    </View>
  );
}
