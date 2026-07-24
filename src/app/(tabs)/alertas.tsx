import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AlertItem } from '@/components/AlertItem';
import { CalendarioAlertas } from '@/components/CalendarioAlertas';
import { Card, Chip, EmptyState, Header, Icon, type IconName, Screen, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import type { Alerta, AlertaGravidade } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

type Vista = 'lista' | 'calendario';

export default function AlertasScreen() {
  const { alertas, exploracoes, dispensarAlerta } = useGado();
  const [vista, setVista] = useState<Vista>('lista');
  const [exploracaoId, setExploracaoId] = useState<string | undefined>(undefined);

  // Os grupos vivem aqui dentro (e não no topo do módulo) para lerem as cores
  // no render — ver `theme/paletas.ts`.
  const grupos: { chave: AlertaGravidade; titulo: string; cor: string }[] = [
    { chave: 'urgente', titulo: 'Urgente', cor: colors.danger },
    { chave: 'aviso', titulo: 'Esta semana', cor: colors.warning },
    { chave: 'info', titulo: 'A acompanhar', cor: colors.info },
  ];

  // Só vale a pena escolher exploração quando há mais do que uma. Com uma só,
  // o filtro seria uma linha de chips que não muda nada.
  const podeFiltrar = exploracoes.length > 1;

  const visiveis = useMemo(
    () => (exploracaoId ? alertas.filter((a) => a.exploracaoId === exploracaoId) : alertas),
    [alertas, exploracaoId],
  );

  const nomeExploracao = exploracoes.find((e) => e.id === exploracaoId)?.nome;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Alertas e prazos" />
      <Screen>
        {/* Lista ou calendário */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            padding: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceSunken,
            marginBottom: spacing.md,
          }}>
          <Separador
            label="Lista"
            icon="format-list-bulleted"
            ativo={vista === 'lista'}
            onPress={() => setVista('lista')}
          />
          <Separador
            label="Calendário"
            icon="calendar-month-outline"
            ativo={vista === 'calendario'}
            onPress={() => setVista('calendario')}
          />
        </View>

        {/* Por exploração */}
        {podeFiltrar ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.xs,
              marginBottom: spacing.md,
            }}>
            <Chip
              label="Todas"
              icon="barn"
              selected={exploracaoId === undefined}
              onPress={() => setExploracaoId(undefined)}
            />
            {exploracoes.map((e) => (
              <Chip
                key={e.id}
                label={e.nome}
                selected={exploracaoId === e.id}
                onPress={() => setExploracaoId(exploracaoId === e.id ? undefined : e.id)}
              />
            ))}
          </View>
        ) : null}

        {visiveis.length === 0 ? (
          <EmptyState
            icon="check-circle-outline"
            title="Tudo em dia"
            message={
              nomeExploracao
                ? `Não há prazos nem tarefas pendentes em ${nomeExploracao}.`
                : 'Não há prazos legais nem tarefas pendentes. Bom trabalho!'
            }
          />
        ) : vista === 'calendario' ? (
          <CalendarioAlertas alertas={visiveis} onDispensar={dispensarAlerta} />
        ) : (
          grupos.map((g) => {
            const doGrupo = visiveis.filter((a: Alerta) => a.gravidade === g.chave);
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

/** Um dos dois lados do interruptor Lista / Calendário. */
function Separador({
  label,
  icon,
  ativo,
  onPress,
}: {
  label: string;
  icon: IconName;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: 44,
          borderRadius: radii.pill,
          backgroundColor: ativo ? colors.surface : 'transparent',
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="sm" color={ativo ? colors.primary : colors.textSecondary} />
      <Text variant="label" color={ativo ? colors.primaryDark : colors.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}
