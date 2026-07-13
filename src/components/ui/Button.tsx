import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, shadow, sizes, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const palette: Record<
  Variant,
  { bg: string; fg: string; border?: string; shadow?: boolean }
> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, shadow: true },
  secondary: { bg: colors.primaryTint, fg: colors.primaryDark },
  ghost: { bg: 'transparent', fg: colors.primaryDark, border: colors.borderStrong },
  danger: { bg: colors.danger, fg: '#FFFFFF', shadow: true },
};

/**
 * Botão primário grande (56px, README) com feedback de pressão, estado
 * de carregamento (desabilita + spinner) e estados desabilitados claros.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: Props) {
  const p = palette[variant];
  const isOff = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          minHeight: sizes.button,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        p.shadow && !isOff ? shadow.md : null,
        pressed && !isOff && { opacity: 0.92, transform: [{ scale: 0.98 }] },
        isOff && { opacity: 0.45 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {icon ? <Icon name={icon} size="sm" color={p.fg} /> : null}
          <Text style={[type.button, { color: p.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
