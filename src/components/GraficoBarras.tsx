import { View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

type Ponto = {
  label: string;
  valor: number;
  legenda?: string;
};

/**
 * Bar chart minimalista feito com Views nativas — sem dependência de SVG.
 * Escala automaticamente pelo maior valor; mostra label abaixo de cada barra
 * e o valor no topo. Design consistente com o resto da app (raios, cores).
 */
export function GraficoBarras({
  pontos,
  altura = 140,
  cor = colors.primary,
  formatValor = (v: number) => String(v),
  title,
}: {
  pontos: Ponto[];
  altura?: number;
  cor?: string;
  formatValor?: (v: number) => string;
  title?: string;
}) {
  const max = Math.max(1, ...pontos.map((p) => p.valor));

  return (
    <View>
      {title ? (
        <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.xs }}>
          {title}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.xs,
          height: altura,
        }}>
        {pontos.map((p) => {
          const h = Math.max(2, Math.round((p.valor / max) * (altura - 30)));
          return (
            <View key={p.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Text variant="caption" color={colors.textMuted} style={{ marginBottom: 2 }}>
                {formatValor(p.valor)}
              </Text>
              <View
                style={{
                  width: '80%',
                  height: h,
                  backgroundColor: cor,
                  borderTopLeftRadius: radii.sm,
                  borderTopRightRadius: radii.sm,
                  opacity: p.valor === 0 ? 0.25 : 1,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
        {pontos.map((p) => (
          <View key={p.label} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="caption" color={colors.textMuted}>{p.label}</Text>
            {p.legenda ? (
              <Text variant="caption" color={colors.textMuted}>{p.legenda}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
