import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, shadow, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  elevation?: keyof typeof shadow;
  accessibilityLabel?: string;
};

/**
 * Cartão branco arredondado com sombra suave — a superfície base da app,
 * como na inspiração. Se receber `onPress`, dá feedback de pressão
 * (opacidade + leve escala) sem deslocar o layout (regra press-feedback).
 */
export function Card({
  children,
  onPress,
  padded = true,
  style,
  elevation = 'sm',
  accessibilityLabel,
}: Props) {
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: padded ? spacing.lg : 0,
      borderWidth: 1,
      borderColor: colors.border,
    },
    shadow[elevation],
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        base,
        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
      ]}>
      {children}
    </Pressable>
  );
}
