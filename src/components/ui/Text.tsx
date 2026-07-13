import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, type as typeScale, type TypeVariantName } from '@/theme';

type Props = RNTextProps & {
  variant?: TypeVariantName;
  color?: string;
  center?: boolean;
};

/**
 * Texto tipado ao sistema tipográfico. Respeita o dimensionamento do
 * sistema (allowFontScaling por omissão) para suportar Dynamic Type.
 */
export function Text({
  variant = 'body',
  color = colors.text,
  center,
  style,
  ...rest
}: Props) {
  return (
    <RNText
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
