import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Card, EmptyState, Header, Icon, Screen, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import { useExistencias } from '@/data/useExistencias';
import { useGado } from '@/data/store';
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
      avisar('Não foi possível guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setAGuardar(false);
    }
  }

  if (!podeLigarDesligar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Registo de medicamentos" />
        <Screen>
          <EmptyState
            icon="lock-outline"
            title="Só quem gere a exploração"
            message="Esta definição pertence ao dono da exploração. Fale com ele se precisar de dar entrada de medicamentos na app."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Registo de medicamentos" />
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
              <Text variant="h3">Gerir a arrecadação na app</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                {ativas ? 'Ligado' : 'Desligado'}
              </Text>
            </View>
            <Switch
              value={ativas}
              onValueChange={alternar}
              disabled={aGuardar}
              accessibilityLabel="Gerir a arrecadação na app"
              trackColor={{ false: colors.borderStrong, true: colors.success }}
              thumbColor={colors.white}
            />
          </View>
        </Card>

        <Text variant="h3" style={{ marginBottom: spacing.sm }}>
          O que isto muda
        </Text>
        <Card padded={false} style={{ marginBottom: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.md }}>
            <Linha
              icon="package-variant-closed"
              titulo="Separador Existências"
              texto="Os lotes que comprou, o que resta de cada um e a validade. Desligado, o separador desaparece da app."
              divider
            />
            <Linha
              icon="needle"
              titulo="Escolher o lote no tratamento"
              texto="Ao registar uma vacina ou um medicamento deixa de lhe ser perguntado de que frasco saiu. O registo sanitário continua igual: o animal, a data, o produto e o intervalo de segurança ficam todos."
              divider
            />
            <Linha
              icon="bell-outline"
              titulo="Avisos de validade e de stock"
              texto="Deixa de ser avisado quando um lote está a acabar ou a chegar à validade."
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
              ? `Desligar não apaga nada. Os ${medicamentos.length} ${medicamentos.length === 1 ? 'lote que já registou fica guardado e volta' : 'lotes que já registou ficam guardados e voltam'} a aparecer se ligar outra vez.`
              : 'Desligar não apaga nada. O que registar fica sempre guardado, mesmo que volte a desligar mais tarde.'}
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
            O registo de medicamentos é obrigatório por lei e pode ser pedido numa
            inspeção. Desligue-o só se o mantiver noutro sítio.
          </Text>
        </View>

        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ marginTop: spacing.md, textAlign: 'center' }}>
          Esta definição vale para todas as suas explorações.
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
