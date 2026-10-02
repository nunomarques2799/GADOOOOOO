import { Pressable, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  icon?: IconName;
  /**
   * Um ponto de cor antes do rótulo, como nas escolhas do guia ("● Brinco e
   * SNIRA"). A cor nunca vai sozinha: o rótulo diz o que ela quer dizer.
   */
  ponto?: string;
  onPress?: () => void;
  /** O que um leitor de ecrã anuncia, quando o rótulo sozinho não chega. */
  accessibilityLabel?: string;
};

/**
 * Pastilha de escolha (espécie, sexo, filtro…).
 *
 * Por escolher: superfície com uma linha à volta e letra de tinta. Escolhida:
 * cheia da cor da marca e letra clara, para se ver de longe qual está ligada.
 */
export function Chip({ label, selected = false, icon, ponto, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 44,
          paddingHorizontal: spacing.md,
          borderRadius: radii.pill,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}>
      {ponto ? (
        <View style={{ width: 10, height: 10, borderRadius: radii.pill, backgroundColor: ponto }} />
      ) : null}
      {icon ? (
        <Icon name={icon} size="sm" color={selected ? colors.onPrimary : colors.textSecondary} />
      ) : null}
      <Text style={[type.label, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}
