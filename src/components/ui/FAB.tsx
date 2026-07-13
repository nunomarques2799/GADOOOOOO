import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadow, sizes, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  icon?: IconName;
  onPress: () => void;
};

/**
 * Botão de ação flutuante (pill) ancorado em baixo à direita, acima da
 * barra de separadores. Ação principal de "adicionar" nas listas.
 */
export function FAB({ label, icon = 'plus', onPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: spacing.lg,
          bottom: insets.bottom + spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height: sizes.button,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.pill,
          backgroundColor: colors.primary,
        },
        shadow.raised,
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}>
      <Icon name={icon} size="md" color={colors.onPrimary} />
      <Text style={[type.button, { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}
