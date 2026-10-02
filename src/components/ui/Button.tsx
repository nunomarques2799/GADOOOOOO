import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { t } from '@/i18n';

import { colors, radii, sizes, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';
import { NATIVO, semMovimento } from './movimento';
import { Text } from './Text';
import { PressableAnimado, useEscalaToque } from './useEscalaToque';

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
  /**
   * Gravou: o texto dá lugar a um visto, que aparece com um pequeno salto.
   * Vem de `useVisto()`, que o liga uns instantes antes de o formulário
   * fechar, para o criador VER que gravou antes de o ecrã mudar.
   */
  concluido?: boolean;
};

/**
 * As cores são GETTERS, não valores.
 *
 * Esta tabela nasce no arranque do módulo, antes de a paleta escolhida estar
 * aplicada (ver `theme/paletas.ts`). Com valores diretos, o botão primário
 * ficava da cor de origem numa app que o criador tinha posto azul — e era o
 * único: tudo o resto, que lê as cores durante o render, mudava. O `danger`
 * também é getter: não muda com a paleta, mas muda de tom na Noite.
 *
 * `node scripts/cores-no-arranque.js` procura este erro no projeto todo.
 */
const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: {
    get bg() {
      return colors.primary;
    },
    get fg() {
      return colors.onPrimary;
    },
  },
  secondary: {
    get bg() {
      return colors.primaryTint;
    },
    get fg() {
      return colors.primaryDark;
    },
  },
  // O "Cancelar" do guia: sem fundo, com uma linha à volta e letra de tinta.
  ghost: {
    get bg() {
      return colors.surface;
    },
    get fg() {
      return colors.text;
    },
    get border() {
      return colors.primary;
    },
  },
  danger: {
    get bg() {
      return colors.danger;
    },
    get fg() {
      return colors.onDanger;
    },
  },
};

/**
 * Botão grande (56px, README) com feedback de pressão, estado de
 * carregamento (desabilita + spinner) e estados desabilitados claros.
 *
 * Plano e de cantos de 16, como no guia: a sombra fica para o que flutua.
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
  concluido = false,
}: Props) {
  const p = palette[variant];
  // Com o visto à vista o botão não se desliga nem esbate: é a confirmação, e
  // tem de se ver bem, mesmo que o formulário ainda esteja "a gravar".
  const isOff = !concluido && (disabled || loading);
  const toque = useEscalaToque(0.97);

  return (
    <PressableAnimado
      onPress={concluido ? undefined : onPress}
      onPressIn={toque.onPressIn}
      onPressOut={toque.onPressOut}
      disabled={isOff || concluido}
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff, busy: loading && !concluido }}
      accessibilityLabel={concluido ? t('comum.guardado') : label}
      style={[
        {
          minHeight: sizes.button,
          borderRadius: radii.botao,
          paddingHorizontal: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        isOff && { opacity: 0.45 },
        style,
        toque.estilo,
      ]}>
      {concluido ? (
        <Visto cor={p.fg} />
      ) : loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        // O rótulo pode ir a duas linhas: "Registar para a Castanha" com a
        // letra no máximo não cabe numa, e sem o `flexShrink` saía pelas
        // bordas do botão em vez de partir.
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
          {icon ? <Icon name={icon} size="sm" color={p.fg} /> : null}
          <Text style={[type.button, { color: p.fg, flexShrink: 1, textAlign: 'center' }]}>{label}</Text>
        </View>
      )}
    </PressableAnimado>
  );
}

/** O visto do Guardar: cresce até ao tamanho certo com uma pequena mola. */
function Visto({ cor }: { cor: string }) {
  const escala = useRef(new Animated.Value(semMovimento() ? 1 : 0.4)).current;
  useEffect(() => {
    if (semMovimento()) return;
    Animated.spring(escala, {
      toValue: 1,
      speed: 12,
      bounciness: 10,
      useNativeDriver: NATIVO,
    }).start();
  }, [escala]);
  return (
    <Animated.View style={{ transform: [{ scale: escala }] }}>
      <Icon name="check-bold" size={26} color={cor} />
    </Animated.View>
  );
}
