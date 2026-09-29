import { Image } from 'expo-image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { ABRANDAR, DURACAO, NATIVO, semMovimento } from '@/components/ui/movimento';
import { colors, radii } from '@/theme';

/**
 * O retrato do animal a "voar" da lista para o topo da ficha.
 *
 * Como funciona, porque são três peças em sítios diferentes:
 *   1. a linha da lista mede onde está o retrato e chama \`iniciarVoo\` antes
 *      de abrir a ficha (a ficha abre em fade, não a deslizar: ver o
 *      \`_layout.tsx\` de cima);
 *   2. a ficha mede onde fica o retrato grande e chama \`chegadaDoVoo\`, e
 *      esconde o seu enquanto o voo dura (\`useVooEmCurso\`);
 *   3. a \`CamadaVoo\`, por cima de toda a navegação, desenha o retrato a ir de
 *      um sítio ao outro, e a mudar do aspeto da lista para o da ficha.
 *
 * Se a ficha não disser onde fica o retrato a tempo (um ecrã que demorou, um
 * animal que já não existe), o voo desiste sozinho: nunca fica um retrato
 * parado a meio do ecrã.
 */

type Caixa = { x: number; y: number; w: number; h: number };
type Voo = {
  id: string;
  de: Caixa;
  para: Caixa | null;
  foto?: string;
  icone: IconName;
  /** A cor do ícone na lista (a do sexo). */
  cor: string;
  /** O fundo do retrato na lista. */
  fundo: string;
};

let voo: Voo | null = null;
let desistir: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());
const subscrever = (o: () => void) => {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
};
const instantaneo = () => voo;

function acabar() {
  if (desistir) clearTimeout(desistir);
  desistir = null;
  voo = null;
  avisar();
}

/** A lista chama isto ao tocar num animal, com o sítio do retrato no ecrã. */
export function iniciarVoo(v: Omit<Voo, 'para'>): void {
  if (semMovimento()) return;
  if (desistir) clearTimeout(desistir);
  voo = { ...v, para: null };
  desistir = setTimeout(acabar, 900);
  avisar();
}

/** A ficha chama isto quando sabe onde fica o seu retrato. */
export function chegadaDoVoo(id: string, para: Caixa): void {
  if (!voo || voo.id !== id || voo.para) return;
  voo = { ...voo, para };
  avisar();
}

/** Se o retrato desta ficha ainda vem a caminho (a ficha esconde o seu). */
export function useVooEmCurso(id: string): boolean {
  const v = useSyncExternalStore(subscrever, instantaneo, instantaneo);
  return !!v && v.id === id;
}

/**
 * O retrato em voo. Monta-se uma vez, por cima de toda a navegação, e não
 * apanha toques (\`pointerEvents="none"\`).
 */
export function CamadaVoo() {
  const v = useSyncExternalStore(subscrever, instantaneo, instantaneo);
  const origem = useRef<View>(null);
  const [desvio, setDesvio] = useState({ x: 0, y: 0 });
  const p = useRef(new Animated.Value(0)).current;

  // A camada pode não começar no canto do ecrã (a coluna centrada do
  // computador, a faixa de testes): as medidas vêm em coordenadas da janela,
  // e é preciso descontar onde a própria camada está.
  const medir = () =>
    origem.current?.measureInWindow((x, y) => {
      if (x !== desvio.x || y !== desvio.y) setDesvio({ x, y });
    });

  const para = v?.para;
  useEffect(() => {
    if (!para) return;
    p.setValue(0);
    Animated.timing(p, {
      toValue: 1,
      duration: DURACAO.voo,
      easing: ABRANDAR,
      useNativeDriver: NATIVO,
    }).start(() => acabar());
  }, [para, p]);

  if (!v || !v.para) {
    return <View ref={origem} onLayout={medir} pointerEvents="none" style={StyleSheet.absoluteFill} />;
  }

  const { de } = v;
  const centro = (c: Caixa) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });
  const a = centro(de);
  const b = centro(v.para);
  const escala = v.para.w / de.w;

  return (
    <View ref={origem} onLayout={medir} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          left: de.x - desvio.x,
          top: de.y - desvio.y,
          width: de.w,
          height: de.h,
          transform: [
            { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, b.x - a.x] }) },
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, b.y - a.y] }) },
            { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, escala] }) },
          ],
        }}>
        {/* Como está na lista: fundo na cor do sexo, ícone da espécie. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: v.foto ? de.w / 2 : radii.md,
              backgroundColor: v.fundo,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              opacity: p.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.3, 0] }),
            },
          ]}>
          {v.foto ? (
            <Image source={{ uri: v.foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Icon name={v.icone} size={de.w * 0.58} color={v.cor} />
          )}
        </Animated.View>
        {/* Como fica na ficha: círculo claro sobre o verde, ícone branco. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: de.w / 2,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              opacity: p.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] }),
            },
          ]}>
          {v.foto ? (
            <Image source={{ uri: v.foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Icon name={v.icone} size={(52 / 88) * de.w} color={colors.textOnDark} />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
