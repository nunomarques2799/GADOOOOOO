import type { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVoltarAoTopo } from '@/data/voltarAoTopo';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, spacing } from '@/theme';

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
  /**
   * Nome do separador da barra de baixo a que este ecra pertence.
   *
   * Dado, tocar outra vez no icone desse separador volta ao topo desta lista
   * (ver `data/voltarAoTopo.ts`). So faz sentido nos ecras que sao um
   * separador; nos outros nao ha icone nenhum onde tocar.
   */
  separador?: string;
} & Pick<ScrollViewProps, 'stickyHeaderIndices' | 'onScroll' | 'refreshControl'>;

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
  separador,
  ...scrollProps
}: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  // `''` quando o ecrã não é um separador: o `registarLista` guarda-o à mesma,
  // numa chave que a barra nunca procura, e não há um caminho a mais no hook.
  const refTopo = useVoltarAoTopo(separador ?? '');

  const paddingTop = topInset ? insets.top : 0;
  const paddingBottom = insets.bottom + spacing.xxl;
  const paddingHorizontal = padded ? (desktop ? spacing.xxl : spacing.lg) : 0;

  // Em desktop o conteúdo não estica até à borda da janela: linhas de texto
  // muito longas cansam a leitura, por isso limitamos e centramos a coluna.
  const coluna: ViewStyle = desktop
    ? { width: '100%', maxWidth: layout.conteudoDesktop, alignSelf: 'center' }
    : { width: '100%' };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: background, paddingTop }, style]}>
        <View style={[{ flex: 1, paddingHorizontal, alignItems: 'center' }, contentStyle]}>
          <View style={[{ flex: 1 }, coluna]}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={refTopo}
      style={[{ flex: 1, backgroundColor: background }, style]}
      contentContainerStyle={[
        { paddingTop, paddingBottom, paddingHorizontal, alignItems: 'center' },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // No iPhone o teclado sobrepõe-se ao ecrã em vez de o encolher, e um
      // campo perto do fundo — o preço numa venda, a nota de uma saída — ficava
      // debaixo dele. Isto faz o iOS encolher o conteúdo pela altura do teclado.
      // Os formulários com barra de gravar fixa não usam este componente: esses
      // vão pelo `EcraComTeclado`, e somar as duas coisas dava o dobro do espaço.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      {...scrollProps}>
      <View style={coluna}>{children}</View>
    </ScrollView>
  );
}
