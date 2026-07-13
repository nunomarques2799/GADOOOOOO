import { Pressable } from 'react-native';

import { colors, radii, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress?: () => void;
};

/** Chip de filtro selecionável (espécie, sexo…). */
export function Chip({ label, selected = false, icon, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 44,
          paddingHorizontal: spacing.md,
          borderRadius: radii.pill,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}>
      {icon ? (
        <Icon name={icon} size="sm" color={selected ? colors.onPrimary : colors.textSecondary} />
      ) : null}
      <Text
        style={[
          type.label,
          { color: selected ? colors.onPrimary : colors.textSecondary },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}
