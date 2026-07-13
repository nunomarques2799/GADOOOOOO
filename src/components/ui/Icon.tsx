import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { colors, sizes } from '@/theme';

/**
 * Ícone único da app. Usamos EXCLUSIVAMENTE o set MaterialCommunityIcons
 * (regra icon-style-consistent) — cobre tanto a UI genérica (home, bell,
 * plus…) como o domínio pecuário (cow, sheep, barn, sprout…).
 */
export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type IconSize = keyof typeof sizes.icon | number;

type Props = {
  name: IconName;
  size?: IconSize;
  color?: string;
};

export function Icon({ name, size = 'md', color = colors.text }: Props) {
  const px = typeof size === 'number' ? size : sizes.icon[size];
  return <MaterialCommunityIcons name={name} size={px} color={color} />;
}
