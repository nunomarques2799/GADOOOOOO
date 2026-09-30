import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { ABRANDAR, DURACAO, NATIVO, semMovimento } from '@/components/ui/movimento';
import { useGado } from '@/data/store';
import { useTerminarSessao } from '@/hooks/useTerminarSessao';
import { t } from '@/i18n';
import { colors, radii, shadow, spacing } from '@/theme';

/** Onde está o botão que abriu o menu, em coordenadas da janela. */
export type Ancora = { x: number; y: number; w: number; h: number };

/**
 * O menu que abre ao tocar na inicial, no canto do Início.
 *
 * Ia direto ao Perfil; um toque na inicial é, noutras apps, o sítio da conta,
 * e as coisas da conta são várias. Abre por baixo da inicial, encostado à
 * direita, e fecha ao tocar fora.
 */
export function MenuConta({
  aberto,
  onFechar,
  ancora,
}: {
  aberto: boolean;
  onFechar: () => void;
  ancora: Ancora | null;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { utilizador, pendentesSinc } = useGado();
  const pedirParaSair = useTerminarSessao(pendentesSinc);
  const [montado, setMontado] = useState(aberto);
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (aberto) {
      setMontado(true);
      if (semMovimento()) return p.setValue(1);
      p.setValue(0);
      Animated.timing(p, { toValue: 1, duration: DURACAO.fundo, easing: ABRANDAR, useNativeDriver: NATIVO }).start();
      return;
    }
    if (!montado) return;
    if (semMovimento()) return setMontado(false);
    Animated.timing(p, { toValue: 0, duration: DURACAO.toque, useNativeDriver: NATIVO }).start(({ finished }) => {
      if (finished) setMontado(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const ir = (rota: Href) => {
    onFechar();
    router.navigate(rota);
  };

  const opcoes: { icon: IconName; label: string; onPress: () => void; perigo?: boolean }[] = [
    { icon: 'account-outline', label: t('menuConta.perfil'), onPress: () => ir('/perfil') },
    { icon: 'cog-outline', label: t('nav.definicoes'), onPress: () => ir('/definicoes') },
    { icon: 'help-circle-outline', label: t('definicoes.ajuda'), onPress: () => ir('/conta/ajuda') },
    {
      icon: 'logout',
      label: t('perfil.terminarSessao'),
      perigo: true,
      onPress: () => {
        onFechar();
        pedirParaSair();
      },
    },
  ];

  const topo = ancora ? ancora.y + ancora.h + spacing.xs : 80;
  const direita = ancora ? Math.max(spacing.md, width - (ancora.x + ancora.w)) : spacing.md;

  return (
    <Modal visible={montado} transparent animationType="none" onRequestClose={onFechar}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel={t('comum.fechar')}
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            position: 'absolute',
            top: topo,
            right: direita,
            width: 260,
            maxWidth: width - spacing.md * 2,
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: spacing.xs,
            opacity: p,
            transform: [
              { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
              { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          },
          shadow.lg,
        ]}>
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {utilizador.nome}
          </Text>
          {utilizador.email ? (
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
              {utilizador.email}
            </Text>
          ) : null}
        </View>
        {opcoes.map((o) => (
          <Pressable
            key={o.label}
            onPress={o.onPress}
            accessibilityRole="menuitem"
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                minHeight: 52,
                paddingHorizontal: spacing.md,
                borderTopWidth: o.perigo ? 1 : 0,
                borderTopColor: colors.border,
              },
              pressed && { backgroundColor: colors.primaryTint },
            ]}>
            <Icon name={o.icon} size="md" color={o.perigo ? colors.danger : colors.primary} />
            <Text variant="body" color={o.perigo ? colors.danger : colors.text}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}
