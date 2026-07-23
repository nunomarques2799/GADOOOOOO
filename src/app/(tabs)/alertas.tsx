import { View } from 'react-native';

import { AlertItem } from '@/components/AlertItem';
import { Card, EmptyState, Header, Screen, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import type { Alerta, AlertaGravidade } from '@/data/types';
import { colors, spacing } from '@/theme';

const grupos: { chave: AlertaGravidade; titulo: string; cor: string }[] = [
  { chave: 'urgente', titulo: 'Urgente', cor: colors.danger },
  { chave: 'aviso', titulo: 'Esta semana', cor: colors.warning },
  { chave: 'info', titulo: 'A acompanhar', cor: colors.info },
];

export default function AlertasScreen() {
  const { alertas, dispensarAlerta } = useGado();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Alertas e prazos" />
      <Screen>
        {alertas.length === 0 ? (
          <EmptyState
            icon="check-circle-outline"
            title="Tudo em dia"
            message="Não há prazos legais nem tarefas pendentes. Bom trabalho!"
          />
        ) : (
          grupos.map((g) => {
            const doGrupo = alertas.filter((a: Alerta) => a.gravidade === g.chave);
            if (doGrupo.length === 0) return null;
            return (
              <View key={g.chave} style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: g.cor }} />
                  <Text variant="h3">{g.titulo}</Text>
                  <Text variant="secondary" color={colors.textMuted}>
                    ({doGrupo.length})
                  </Text>
                </View>
                <Card padded={false}>
                  <View style={{ paddingHorizontal: spacing.md }}>
                    {doGrupo.map((a, i) => (
                      <AlertItem
                        key={a.id}
                        alerta={a}
                        divider={i < doGrupo.length - 1}
                        onDispensar={dispensarAlerta}
                      />
                    ))}
                  </View>
                </Card>
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}
