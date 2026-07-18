import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon, type IconName, IconBadge, Text } from '@/components/ui';
import type { Alerta, AlertaGravidade } from '@/data/types';
import { colors, spacing } from '@/theme';

const gravidadeMeta: Record<AlertaGravidade, { cor: string; tinte: string }> = {
  urgente: { cor: colors.danger, tinte: colors.dangerTint },
  aviso: { cor: colors.warning, tinte: colors.warningTint },
  info: { cor: colors.info, tinte: colors.infoTint },
};

const categoriaIcone: Record<Alerta['categoria'], IconName> = {
  identificacao: 'tag-outline',
  snira: 'cloud-upload-outline',
  parto: 'baby-bottle-outline',
  medicamento: 'medical-bag',
  vacinacao: 'needle',
};

function prazoLabel(dias?: number): string {
  if (dias === undefined) return '';
  if (dias < 0) return 'Em atraso';
  if (dias === 0) return 'Hoje';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}

export function AlertItem({ alerta, divider }: { alerta: Alerta; divider?: boolean }) {
  const router = useRouter();
  const g = gravidadeMeta[alerta.gravidade];

  return (
    <Pressable
      onPress={() => alerta.animalId && router.push(`/animal/${alerta.animalId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${alerta.titulo}. ${alerta.descricao}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <IconBadge
        name={categoriaIcone[alerta.categoria]}
        color={g.cor}
        background={g.tinte}
        size={44}
        iconSize={22}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {alerta.titulo}
        </Text>
        <Text variant="secondary" color={colors.textSecondary} numberOfLines={2}>
          {alerta.descricao}
        </Text>
      </View>
      {/* O prazo é curto e tem de se ler de uma vez — não encolhe nem parte
          ("5 dias" saía em duas linhas quando a letra do sistema era grande). */}
      <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        <Text variant="caption" color={g.cor} numberOfLines={1}>
          {prazoLabel(alerta.diasRestantes)}
        </Text>
        <Icon name="chevron-right" size="sm" color={colors.textMuted} />
      </View>
    </Pressable>
  );
}
