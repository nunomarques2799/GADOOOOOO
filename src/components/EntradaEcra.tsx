import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform } from 'react-native';

import { ABRANDAR, DURACAO, semMovimento } from '@/components/ui/movimento';

/**
 * Como um ecrã entra:
 *   - `direita`: uma ficha (animal, terreno, exploração) ou outro ecrã de ler;
 *   - `baixo`: um formulário, que se preenche e fecha;
 *   - `fade`: a ficha aberta da lista de animais, onde quem se mexe é o
 *     retrato (ver `VooAnimal.tsx`) e o ecrã só aparece por baixo dele;
 *   - `nenhum`: os separadores, que têm o seu próprio deslize.
 */
export type ModoEntrada = 'direita' | 'baixo' | 'fade' | 'nenhum';

/**
 * A entrada dos ecrãs na WEB e no Windows.
 *
 * No telemóvel quem anima é o sistema (a pilha nativa desliza da direita e os
 * formulários sobem de baixo). Na web essa pilha não anima nada: o ecrã novo
 * aparecia de uma vez, e era a "app que salta". Aqui entra uma versão leve do
 * mesmo gesto: 32 px da direita, ou 40 px de baixo, a aparecer em fade.
 *
 * É leve de propósito. Na web o ecrã de trás é escondido no mesmo instante, e
 * um deslize do ecrã inteiro mostraria o fundo vazio por baixo dele.
 */
export function EntradaEcra({ modo, children }: { modo: ModoEntrada; children: ReactNode }) {
  const animar = useRef(Platform.OS === 'web' && modo !== 'nenhum' && !semMovimento()).current;
  const p = useRef(new Animated.Value(animar ? 0 : 1)).current;

  useEffect(() => {
    if (!animar) return;
    Animated.timing(p, {
      toValue: 1,
      duration: DURACAO.ecra,
      easing: ABRANDAR,
      useNativeDriver: false,
    }).start();
  }, [animar, p]);

  if (!animar) return <>{children}</>;
  const desvio =
    modo === 'baixo'
      ? [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
      : modo === 'direita'
        ? [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }]
        : [];
  return <Animated.View style={{ flex: 1, opacity: p, transform: desvio }}>{children}</Animated.View>;
}
