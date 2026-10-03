import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logotipo } from '@/components/Logotipo';
import { DURACAO, ABRANDAR, semMovimento } from '@/components/ui/movimento';
import { t } from '@/i18n';
import { colors, radii, shadow } from '@/theme';

/**
 * "A atualizar": o logótipo com um arco dourado a dar a volta (opção 1,
 * escolhida pelo Nuno a 2026-10-03; ver o artifact "Abertura da Terrabovina").
 * ------------------------------------------------------------------
 * Substitui a roda do sistema no gesto de puxar a lista para baixo. Há UM
 * indicador para a app inteira, montado na raiz, e uma LOJA DE MÓDULO a dizer
 * se há alguma atualização a correr: são oito ecrãs com o gesto, e cada um a
 * desenhar o seu indicador eram oito cópias a separarem-se com o tempo (é o
 * mesmo desenho do contador das denúncias, ver `useDenuncias.ts`).
 *
 * O arco é a moldura de um círculo com dois lados pintados, a rodar. Não há
 * `react-native-svg` na app (ver `Logotipo.tsx`), e uma moldura parcial a
 * girar é a forma de ter um arco sem ele.
 */

let aCorrer = 0;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());

/** Uma atualização começou (o `useAtualizarPuxando` chama-o). */
export function comecarAtualizar() {
  aCorrer += 1;
  avisar();
}

/** Uma atualização acabou, bem ou mal. */
export function acabarAtualizar() {
  aCorrer = Math.max(0, aCorrer - 1);
  avisar();
}

function subscrever(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function useAAtualizar(): boolean {
  return useSyncExternalStore(subscrever, () => aCorrer > 0, () => false);
}

const LOGO = 40;
const ARO = 52;

export function IndicadorAtualizar() {
  const ativo = useAAtualizar();
  const insets = useSafeAreaInsets();
  // Fica montado até acabar de sair, para a saída também se ver.
  const [visivel, setVisivel] = useState(false);
  const entrada = useRef(new Animated.Value(0)).current;
  const roda = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (ativo) setVisivel(true);
    if (semMovimento()) {
      entrada.setValue(ativo ? 1 : 0);
      if (!ativo) setVisivel(false);
      return;
    }
    const anim = Animated.timing(entrada, {
      toValue: ativo ? 1 : 0,
      duration: ativo ? DURACAO.fundo : DURACAO.folhaFechar,
      easing: ABRANDAR,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !ativo) setVisivel(false);
    });
    return () => anim.stop();
  }, [ativo, entrada]);

  useEffect(() => {
    if (!visivel || semMovimento()) return;
    roda.setValue(0);
    // Uma volta a cada 750 ms: o teto das durações da app (ver `movimento.ts`).
    const volta = Animated.loop(
      Animated.timing(roda, { toValue: 1, duration: 750, easing: Easing.linear, useNativeDriver: true }),
    );
    volta.start();
    return () => volta.stop();
  }, [visivel, roda]);

  if (!visivel) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLabel={t('banner.aAtualizar')}
      style={[
        estilos.sitio,
        {
          top: insets.top + 12,
          opacity: entrada,
          transform: [
            { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
            { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          ],
        },
      ]}>
      <View style={[estilos.bolha, { backgroundColor: colors.surface, borderColor: colors.border }, shadow.md]}>
        <Logotipo tamanho={LOGO} />
        <Animated.View
          style={[
            estilos.arco,
            {
              borderTopColor: colors.warningVivo,
              borderRightColor: colors.warningVivo,
              transform: [{ rotate: roda.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  sitio: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 900 },
  bolha: {
    width: ARO + 12,
    height: ARO + 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arco: {
    position: 'absolute',
    width: ARO,
    height: ARO,
    borderRadius: ARO / 2,
    borderWidth: 3,
    borderColor: 'transparent',
  },
});
