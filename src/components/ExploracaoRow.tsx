import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Card, Icon, IconBadge, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import type { Exploracao } from '@/data/types';
import { colors, spacing } from '@/theme';

export function ExploracaoRow({ exploracao }: { exploracao: Exploracao }) {
  const router = useRouter();
  const { animaisByExploracao, terrenosByExploracao } = useGado();
  const nAnimais = animaisByExploracao(exploracao.id).length;
  const nTerrenos = terrenosByExploracao(exploracao.id).length;

  return (
    <Card
      onPress={() => router.push(`/exploracao/${exploracao.id}`)}
      accessibilityLabel={`${exploracao.nome}, ${nAnimais} animais`}
      style={{ marginBottom: spacing.sm }}
      padded={false}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <IconBadge name="barn" color={colors.primary} background={colors.primaryTint} size={52} iconSize={30} />
          <View style={{ flex: 1 }}>
            <Text variant="h3" numberOfLines={1}>
              {exploracao.nome}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="map-marker" size={13} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {exploracao.localizacao ?? 'Sem localização'}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size="md" color={colors.textMuted} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.lg,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
          <MiniStat icon="cow" value={nAnimais} label="animais" />
          <MiniStat icon="grass" value={nTerrenos} label="terrenos" />
          <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text variant="caption" color={colors.textSecondary}>
              {exploracao.marcaExploracao}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function MiniStat({ icon, value, label }: { icon: 'cow' | 'grass'; value: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size="sm" color={colors.primary} />
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="secondary" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}
