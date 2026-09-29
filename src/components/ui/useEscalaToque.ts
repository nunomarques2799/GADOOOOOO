import { useCallback, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

import { ABRANDAR, DURACAO, NATIVO, semMovimento } from './movimento';

/** O `Pressable` que aceita estilos animados (a escala do toque). */
export const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/**
 * A resposta ao toque: o elemento encolhe um pouco enquanto o dedo está em
 * cima, e volta quando sai.
 *
 * É o que faz a app parecer que OUVIU o toque antes de mudar de ecrã. Estava
 * lá, mas de uma vez (a escala saltava de 1 para 0,98), e um salto de 2% não
 * se vê; animada em 110 ms, vê-se sem se notar.
 *
 * Só a escala, de propósito: a opacidade já é usada por quem chama (um animal
 * que saiu do efetivo aparece esbatido) e uma segunda por cima apagava-a.
 */
export function useEscalaToque(escalaPremido = 0.97) {
  const escala = useRef(new Animated.Value(1)).current;

  const para = useCallback(
    (valor: number) => {
      if (semMovimento()) {
        escala.setValue(1);
        return;
      }
      Animated.timing(escala, {
        toValue: valor,
        duration: DURACAO.toque,
        easing: ABRANDAR,
        useNativeDriver: NATIVO,
      }).start();
    },
    [escala],
  );

  return {
    estilo: { transform: [{ scale: escala }] },
    onPressIn: useCallback(() => para(escalaPremido), [para, escalaPremido]),
    onPressOut: useCallback(() => para(1), [para]),
  };
}
