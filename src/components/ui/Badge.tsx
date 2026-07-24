import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/**
 * Os tons que dependem da paleta são GETTERS, não valores.
 *
 * Esta tabela é criada no arranque do módulo, antes de a paleta escolhida
 * estar aplicada; com valores diretos, um `neutral` ou um `brand` ficavam
 * verdes para sempre numa app que o criador pôs azul. Assim a cor só é lida
 * quando o crachá se desenha. Os tons semânticos não mudam com a paleta e
 * podem ficar como estão.
 */
const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: {
    get bg() {
      return colors.surfaceSunken;
    },
    get fg() {
      return colors.textSecondary;
    },
  },
  success: { bg: colors.successTint, fg: colors.success },
  warning: { bg: colors.warningTint, fg: '#9A6410' },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  info: { bg: colors.infoTint, fg: colors.info },
  brand: {
    get bg() {
      return colors.primaryTint;
    },
    get fg() {
      return colors.primaryDark;
    },
  },
};

type Props = {
  label: string;
  tone?: Tone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

/** Etiqueta de estado. Cor funcional acompanhada sempre de texto (e ícone). */
export function Badge({ label, tone = 'neutral', icon, style }: Props) {
  const t = tones[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          backgroundColor: t.bg,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: 5,
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={14} color={t.fg} /> : null}
      <Text variant="caption" color={t.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}
