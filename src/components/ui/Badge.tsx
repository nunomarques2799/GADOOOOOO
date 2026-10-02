import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fontFamily, radii, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Tone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'saude'
  | 'femea'
  | 'macho';

/**
 * As cores de cada tom são GETTERS, não valores.
 *
 * Esta tabela é criada no arranque do módulo, antes de a paleta escolhida
 * estar aplicada; com valores diretos, um `neutral` ou um `brand` ficavam com
 * a cor de origem numa app que o criador pôs azul, e os tons com significado
 * ficavam com a letra escura na Noite (onde passam a claros). Assim a cor só é
 * lida quando a etiqueta se desenha.
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
  success: {
    get bg() {
      return colors.successTint;
    },
    get fg() {
      return colors.success;
    },
  },
  warning: {
    get bg() {
      return colors.warningTint;
    },
    get fg() {
      return colors.warning;
    },
  },
  danger: {
    get bg() {
      return colors.dangerTint;
    },
    get fg() {
      return colors.danger;
    },
  },
  info: {
    get bg() {
      return colors.infoTint;
    },
    get fg() {
      return colors.info;
    },
  },
  brand: {
    get bg() {
      return colors.primaryTint;
    },
    get fg() {
      return colors.primaryDark;
    },
  },
  saude: {
    get bg() {
      return colors.saudeTint;
    },
    get fg() {
      return colors.saude;
    },
  },
  femea: {
    get bg() {
      return colors.femeaTint;
    },
    get fg() {
      return colors.femea;
    },
  },
  macho: {
    get bg() {
      return colors.machoTint;
    },
    get fg() {
      return colors.macho;
    },
  },
};

type Props = {
  label: string;
  tone?: Tone;
  icon?: IconName;
  /**
   * Cheia da cor do tom, com letra clara por cima — para o que tem de saltar à
   * vista, como o "2 urgentes" do Início. Só com tons que aguentam letra clara
   * (`danger`, `brand`, `success`, `info`, `saude`).
   */
  cheia?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Etiqueta de estado. Cor funcional acompanhada sempre de texto (e ícone). */
export function Badge({ label, tone = 'neutral', icon, cheia = false, style }: Props) {
  const t = tones[tone];
  const fundo = cheia ? t.fg : t.bg;
  const letra = cheia ? (tone === 'danger' ? colors.onDanger : colors.onPrimary) : t.fg;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          backgroundColor: fundo,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={14} color={letra} /> : null}
      <Text
        variant="caption"
        color={letra}
        numberOfLines={1}
        style={{ flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 19 }}>
        {label}
      </Text>
    </View>
  );
}
