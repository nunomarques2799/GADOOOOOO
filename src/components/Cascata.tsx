import { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';

import { ABRANDAR, DURACAO, NATIVO, semMovimento } from '@/components/ui/movimento';

/**
 * Os cartões de uma lista a aparecerem um a seguir ao outro, na PRIMEIRA vez
 * que a lista abre.
 *
 * Só na primeira, e isso não é pormenor. As listas vivem em separadores, e o
 * separador já entra com o seu deslize: repetir a cascata a cada volta eram
 * duas animações por cima uma da outra, e ao fim do dia uma lista que demora a
 * aparecer. Também só nos primeiros 12: é o que cabe no ecrã, e uma lista
 * virtualizada volta a montar cartões ao rolar, que não podem animar outra vez.
 */

const PRIMEIROS = 12;
const jaAnimadas = new Set<string>();

export function Cascata({
  lista,
  indice,
  children,
}: {
  /** Nome da lista, para saber se já animou nesta sessão. */
  lista: string;
  indice: number;
  children: ReactNode;
}) {
  const animar = useRef(!semMovimento() && !jaAnimadas.has(lista) && indice < PRIMEIROS).current;
  const p = useRef(new Animated.Value(animar ? 0 : 1)).current;

  useEffect(() => {
    if (!animar) return;
    Animated.timing(p, {
      toValue: 1,
      duration: DURACAO.cascata,
      delay: indice * DURACAO.cascataPasso,
      easing: ABRANDAR,
      useNativeDriver: NATIVO,
    }).start();
    // Os primeiros cartões montam todos no mesmo instante; a lista dá-se por
    // animada pouco depois, para os que montarem a seguir já não animarem.
    const t = setTimeout(() => jaAnimadas.add(lista), 400);
    return () => clearTimeout(t);
  }, [animar, indice, lista, p]);

  if (!animar) return <>{children}</>;
  return (
    <Animated.View
      style={{
        opacity: p,
        transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}
