import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { shadow } from '@/theme';

/**
 * O logótipo da Terrabovina: a cabeça de vaca e as duas espigas num círculo de
 * oliveira.
 *
 * É um PNG e não um SVG de propósito: a app não tem o `react-native-svg`, e
 * acrescentá-lo é um módulo nativo, ou seja um build novo — e uma atualização
 * por cima de uma app instalada sem ele rebentava ao abrir este ecrã. A
 * imagem tem 600 px, que chegam para o maior sítio onde aparece (o ecrã de
 * entrada, a ~130 pt num iPhone a 3x). O desenho original, em vetor, está em
 * `assets/marca/`.
 */
export function Logotipo({
  tamanho = 48,
  sombra = false,
  style,
}: {
  tamanho?: number;
  /** A sombra larga e suave do ecrã de entrada, onde o logótipo está sozinho. */
  sombra?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Terrabovina"
      style={[{ width: tamanho, height: tamanho, borderRadius: tamanho / 2 }, sombra ? shadow.lg : null, style]}>
      <Image
        source={require('../../assets/images/logo-terrabovina.png')}
        style={{ width: tamanho, height: tamanho }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
