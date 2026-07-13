import { View } from 'react-native';

import { colors, radii } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  /** Iniciais (ex: "JF") ou omite para mostrar ícone. */
  initials?: string;
  icon?: IconName;
  size?: number;
  background?: string;
  foreground?: string;
};

/** Avatar circular com iniciais ou ícone. */
export function Avatar({
  initials,
  icon,
  size = 48,
  background = colors.primaryTint,
  foreground = colors.primaryDark,
}: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {initials ? (
        <Text
          style={{
            fontFamily: 'Nunito_800ExtraBold',
            fontSize: size * 0.36,
            color: foreground,
          }}>
          {initials}
        </Text>
      ) : (
        <Icon name={icon ?? 'account'} size={Math.round(size * 0.5)} color={foreground} />
      )}
    </View>
  );
}
