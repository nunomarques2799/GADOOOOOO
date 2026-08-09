import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Card, EmptyState, Header, Icon, Screen, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import { useExistencias } from '@/data/useExistencias';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * Ligar/desligar o registo de medicamentos.
 *
 * Ecrã próprio, e não um interruptor solto na lista de definições, pela mesma
 * razão do das finanças: a escolha afeta toda a equipa, e o criador tem de
 * poder desligá-la sem receio de estar a apagar o que já registou.
 */
export default function ExistenciasDefinicaoScreen() {
  const { medicamentos, definirExistenciasAtivas } = useGado();
  const { ativas, podeLigarDesligar } = useExistencias();
  const [aGuardar, setAGuardar] = useState(false);

  async function alternar(valor: boolean) {
    if (aGuardar) return;
    setAGuardar(true);
    try {
      await definirExistenciasAtivas(valor);
    } catch (e) {
      avisar(t('comum.semGravar'), e instanceof Error ? e.message : String(e));
    } finally {
      setAGuardar(false);
    }
  }

  if (!podeLigarDesligar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('definicoes.existencias')} />
        <Screen>
          <EmptyState
            icon="lock-outline"
            title={t('interruptor.soQuemGere')}
            message={t('interruptor.soQuemGereExistencias')}
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('definicoes.existencias')} />
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
                name="package-variant-closed"
                size="lg"
                color={ativas ? colors.success : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{t('interruptor.gerirArrecadacao')}</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                {ativas ? t('comum.ligado') : t('comum.desligado')}
              </Text>
            </View>
            <Switch
              value={ativas}
              onValueChange={alternar}
              disabled={aGuardar}
              accessibilityLabel={t('interruptor.gerirArrecadacao')}
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
              icon="package-variant-closed"
              titulo={t('interruptor.existencias1Titulo')}
              texto={t('interruptor.existencias1Texto')}
              divider
            />
            <Linha
              icon="needle"
              titulo={t('interruptor.existencias2Titulo')}
              texto={t('interruptor.existencias2Texto')}
              divider
            />
            <Linha
              icon="bell-outline"
              titulo={t('interruptor.existencias3Titulo')}
              texto={t('interruptor.existencias3Texto')}
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
            {medicamentos.length > 0
              ? t('interruptor.desligarComLotes', { n: medicamentos.length })
              : t('interruptor.desligarNaoApaga')}
          </Text>
        </View>

        {/* O aviso que o ecrã das finanças não precisa de dar: aquilo é
            contabilidade e esta é uma obrigação legal. Quem desligar isto tem
            de ter o registo noutro lado — em papel, que é como sempre se fez. */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            alignItems: 'flex-start',
            backgroundColor: colors.warningTint,
            borderRadius: radii.md,
            padding: spacing.md,
            marginTop: spacing.sm,
          }}>
          <Icon name="alert-outline" size="md" color={colors.warning} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            {t('interruptor.obrigacaoLegal')}
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
