import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radii } from '@/theme';

import { Icon, type IconName } from './Icon';

type Props = {
  name: IconName;
  color: string;
  background: string;
  size?: number;
  iconSize?: number;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Ícone dentro de um quadrado/círculo tingido — usado em listas e ações. */
export function IconBadge({
  name,
  color,
  background,
  size = 48,
  iconSize = 24,
  rounded = false,
  style,
}: Props) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: rounded ? size / 2 : radii.md,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Icon name={name} size={iconSize} color={color} />
    </View>
  );
}
