import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Card, EmptyState, Header, Icon, Screen, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import { useGado } from '@/data/store';
import { useFinancas } from '@/data/useFinancas';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * Ligar/desligar a gestão económica.
 *
 * Ecrã próprio, e não um interruptor solto na lista de definições, porque a
 * escolha precisa de ser explicada: afeta toda a equipa, e o criador tem de
 * poder desligá-la sem receio de estar a apagar o que já registou.
 */
export default function FinancasDefinicaoScreen() {
  const { movimentos, definirFinancasAtivas } = useGado();
  const { ativas, podeLigarDesligar } = useFinancas();
  const [aGuardar, setAGuardar] = useState(false);

  async function alternar(valor: boolean) {
    if (aGuardar) return;
    setAGuardar(true);
    try {
      await definirFinancasAtivas(valor);
    } catch (e) {
      avisar(t('comum.semGravar'), e instanceof Error ? e.message : String(e));
    } finally {
      setAGuardar(false);
    }
  }

  if (!podeLigarDesligar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('definicoes.financas')} />
        <Screen>
          <EmptyState
            icon="lock-outline"
            title={t('interruptor.soQuemGere')}
            message={t('interruptor.soQuemGereFinancas')}
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('definicoes.financas')} />
      <Screen>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radii.pill,
                backgroundColor: ativas ? colors.successTint : colors.surfaceSunken,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon
                name="cash-multiple"
                size="lg"
                color={ativas ? colors.success : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{t('interruptor.registarContas')}</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                {ativas ? t('comum.ligado') : t('comum.desligado')}
              </Text>
            </View>
            <Switch
              value={ativas}
              onValueChange={alternar}
              disabled={aGuardar}
              accessibilityLabel={t('interruptor.registarContas')}
              trackColor={{ false: colors.borderStrong, true: colors.success }}
              thumbColor={colors.white}
            />
          </View>
        </Card>

        <Text variant="h3" style={{ marginBottom: spacing.sm }}>
          {t('interruptor.oQueMuda')}
        </Text>
        <Card padded={false} style={{ marginBottom: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.md }}>
            <Linha
              icon="cash-minus"
              titulo={t('interruptor.financas1Titulo')}
              texto={t('interruptor.financas1Texto')}
              divider
            />
            <Linha
              icon="chart-box-outline"
              titulo={t('interruptor.financas2Titulo')}
              texto={t('interruptor.financas2Texto')}
              divider
            />
            <Linha
              icon="needle"
              titulo={t('interruptor.financas3Titulo')}
              texto={t('interruptor.financas3Texto')}
            />
          </View>
        </Card>

        {/* Desligar assusta. Dizer o que acontece aos dados é o que faz a
            diferença entre experimentar e não tocar. */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            alignItems: 'flex-start',
            backgroundColor: colors.infoTint,
            borderRadius: radii.md,
            padding: spacing.md,
          }}>
          <Icon name="information" size="md" color={colors.info} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            {movimentos.length > 0
              ? t('interruptor.desligarComMovimentos', { n: movimentos.length })
              : t('interruptor.desligarNaoApaga')}
          </Text>
        </View>

        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {t('interruptor.valeParaTodas')}
        </Text>
      </Screen>
    </View>
  );
}

function Linha({
  icon,
  titulo,
  texto,
  divider,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  titulo: string;
  texto: string;
  divider?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
        paddingVertical: spacing.md,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
      }}>
      <Icon name={icon} size="md" color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{titulo}</Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {texto}
        </Text>
      </View>
    </View>
  );
}
