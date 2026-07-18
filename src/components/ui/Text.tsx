import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, maxFontScale, type as typeScale, type TypeVariantName } from '@/theme';

type Props = RNTextProps & {
  variant?: TypeVariantName;
  color?: string;
  center?: boolean;
};

/**
 * Texto tipado ao sistema tipográfico. Respeita o dimensionamento do sistema
 * (Dynamic Type / "Tamanho da letra" do Android), mas com um teto por variante
 * (`maxFontScale`) — a escala base já é grande, e sem teto a ampliação máxima
 * do Android parte palavras a meio e esmaga as colunas dos cartões.
 */
export function Text({
  variant = 'body',
  color = colors.text,
  center,
  style,
  maxFontSizeMultiplier,
  ...rest
}: Props) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? maxFontScale[variant]}
      style={[
        typeScale[variant],
        { color },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}
