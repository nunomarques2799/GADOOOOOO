import type { ReactNode } from 'react';
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Renderiza dentro de um ScrollView (por omissão true). */
  scroll?: boolean;
  /** Cor de fundo do ecrã. */
  background?: string;
  /** Padding horizontal no conteúdo. */
  padded?: boolean;
  /** Insere safe-area no topo (desliga quando há cabeçalho colorido próprio). */
  topInset?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
} & Pick<ScrollViewProps, 'stickyHeaderIndices' | 'onScroll'>;

/**
 * Contentor de ecrã. Garante fundo consistente e reserva safe-area
 * inferior para o conteúdo não ficar escondido pela barra de navegação
 * / indicador de gestos (regra fixed-element-offset + safe-area).
 */
export function Screen({
  children,
  scroll = true,
  background = colors.background,
  padded = true,
  topInset = false,
  style,
  contentStyle,
  ...scrollProps
}: Props) {
  const insets = useSafeAreaInsets();

  const paddingTop = topInset ? insets.top : 0;
  const paddingBottom = insets.bottom + spacing.xxl;
  const paddingHorizontal = padded ? spacing.lg : 0;

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: background, paddingTop }, style]}>
        <View style={[{ flex: 1, paddingHorizontal }, contentStyle]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: background }, style]}
      contentContainerStyle={[
        { paddingTop, paddingBottom, paddingHorizontal },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}>
      {children}
    </ScrollView>
  );
}
