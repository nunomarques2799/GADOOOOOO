import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName, Text } from '@/components/ui';
import { useToasts, type Toast, type TipoToast } from '@/data/toasts';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, motion, radii, shadow, sizes, spacing } from '@/theme';

/**
 * Onde os toasts aparecem. Um só sítio na app inteira (ver `_layout.tsx`).
 *
 * Fica em baixo e ACIMA da barra de separadores e do botão flutuante: no
 * telemóvel, um cartão colado ao fundo tapa exatamente o "Novo" que se acabou
 * de usar, e o criador fica a ver o aviso em vez de ver a lista mudar. Em
 * desktop encosta ao canto direito, longe da barra lateral.
 *
 * `pointerEvents="box-none"` no invólucro é o que impede esta camada de comer
 * os toques do ecrã que está por baixo — sem isso, durante os três segundos do
 * aviso a app parecia bloqueada.
 */
export function AnfitriaoToasts() {
  const { toasts, dispensar } = useToasts();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        // Acima da barra de separadores (telemóvel/web estreita) ou apenas
        // afastado do fundo da janela (desktop, que usa a barra lateral).
        paddingBottom: insets.bottom + (desktop ? spacing.lg : sizes.tabBar + spacing.sm),
        paddingHorizontal: spacing.lg,
        alignItems: desktop ? 'flex-end' : 'stretch',
        gap: spacing.xs,
      }}>
      {toasts.map((t) => (
        <Cartao key={t.id} toast={t} onFechar={() => dispensar(t.id)} largo={desktop} />
      ))}
    </View>
  );
}

const META: Record<TipoToast, { icon: IconName; cor: () => string; fundo: () => string }> = {
  // Getters: as cores mudam com a paleta escolhida e uma tabela de módulo
  // congelava a cor de origem (ver DESIGN_SYSTEM.md).
  sucesso: { icon: 'check-circle', cor: () => colors.success, fundo: () => colors.successTint },
  erro: { icon: 'alert-circle', cor: () => colors.danger, fundo: () => colors.dangerTint },
  info: { icon: 'information', cor: () => colors.info, fundo: () => colors.infoTint },
};

function Cartao({
  toast,
  onFechar,
  largo,
}: {
  toast: Toast;
  onFechar: () => void;
  largo: boolean;
}) {
  const meta = META[toast.tipo];
  const entrada = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      // `false` na web: sem isto o React Native Web avisa a cada aviso que o
      // driver nativo não existe, e a app enche a consola de amarelo.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [entrada]);

  return (
    <Animated.View
      style={{
        opacity: entrada,
        transform: [
          { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        ],
        width: largo ? 420 : undefined,
        maxWidth: '100%',
      }}>
      <Pressable
        onPress={onFechar}
        accessibilityRole="button"
        // Lido em voz alta como o que é: a mensagem, e que se toca para fechar.
        accessibilityLabel={`${toast.mensagem}${toast.detalhe ? `. ${toast.detalhe}` : ''}`}
        accessibilityHint="Toque para fechar este aviso"
        // Região viva: o Android lê o cartão só por ele ter aparecido, sem
        // esperar que o dedo lhe caia em cima. O erro interrompe o que estiver a
        // ser lido ("assertive"), o resto espera a vez — a mesma diferença de
        // urgência que já existe no tempo que cada um fica no ecrã.
        accessibilityLiveRegion={toast.tipo === 'erro' ? 'assertive' : 'polite'}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor: meta.cor(),
            backgroundColor: meta.fundo(),
            minHeight: sizes.touchMin,
          },
          shadow.lg,
          pressed && { opacity: 0.85 },
        ]}>
        <Icon name={meta.icon} size="md" color={meta.cor()} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={colors.text}>
            {toast.mensagem}
          </Text>
          {toast.detalhe ? (
            <Text variant="secondary" color={colors.textSecondary}>
              {toast.detalhe}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
