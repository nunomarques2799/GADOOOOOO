import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadow, spacing } from '@/theme';

import { PressableAnimado, useEscalaToque } from './useEscalaToque';

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
    <CardTocavel onPress={onPress} style={base} accessibilityLabel={accessibilityLabel}>
      {children}
    </CardTocavel>
  );
}

/**
 * O cartão que se carrega. À parte, para o gancho da escala só existir nos
 * cartões que respondem ao toque (os de só ler não pagam nada por ele).
 */
function CardTocavel({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const toque = useEscalaToque();
  return (
    <PressableAnimado
      onPress={onPress}
      onPressIn={toque.onPressIn}
      onPressOut={toque.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[style, toque.estilo]}>
      {children}
    </PressableAnimado>
  );
}
