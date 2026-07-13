import { Pressable, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { colors, radii, shadow, spacing } from '@/theme';

type Props = {
  icon: IconName;
  label: string;
  color?: string;
  tint?: string;
  onPress: () => void;
};

/** Ação rápida — tile com ícone tingido e legenda (grelha do início). */
export function QuickAction({
  icon,
  label,
  color = colors.primary,
  tint = colors.primaryTint,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xs,
          alignItems: 'center',
          gap: spacing.xs,
        },
        shadow.sm,
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
      ]}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.md,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size="lg" color={color} />
      </View>
      <Text variant="caption" color={colors.text} center numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
