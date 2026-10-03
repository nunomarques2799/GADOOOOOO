import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { ABRANDAR, semMovimento } from '@/components/ui/movimento';
import { colors } from '@/theme';

/**
 * A abertura da app: "Espigas que crescem" (opção A, escolhida pelo Nuno a
 * 2026-10-03 entre cinco; a página das opções é o artifact "Abertura da
 * Terrabovina").
 * ------------------------------------------------------------------
 * O círculo de oliveira abre, as duas espigas crescem de baixo para cima, a
 * cabeça da vaca sobe por último e pisca o olho. Depois a camada apaga-se e
 * fica a app, que já se desenhou por baixo enquanto isto corria.
 *
 * O logótipo é feito de CAMADAS em PNG (`assets/images/abertura/`), tiradas
 * do SVG mestre (`assets/marca/terrabovina-logo.svg`): a app não tem o
 * `react-native-svg`, e um módulo nativo novo só para isto obrigava a um build
 * e rebentava as apps instaladas a que chegasse por `eas update`. Com camadas,
 * cada parte anima-se com o `Animated` de sempre. As espigas não se desenham
 * traço a traço como na página das opções: aparecem por uma janela que sobe
 * de baixo, que dá a mesma ideia de crescer.
 *
 * Tamanho e sítio são os do ecrã fixo do sistema (160 pt ao centro, no creme;
 * ver o `expo-splash-screen` no `app.json`), para a passagem de um para o
 * outro não dar salto.
 *
 * Não corre com "Reduzir movimento" ligado, nem nos testes (`semMovimento`).
 * Não apanha toques: quem já sabe onde vai pode tocar por baixo dela.
 */
const TAMANHO = 160;

const camadas = {
  fundo: require('../../assets/images/abertura/fundo.png'),
  espigaEsq: require('../../assets/images/abertura/espiga-esq.png'),
  espigaDir: require('../../assets/images/abertura/espiga-dir.png'),
  cabeca: require('../../assets/images/abertura/cabeca.png'),
  olhos: require('../../assets/images/abertura/olhos.png'),
};

/**
 * Vai correr? O `_layout.tsx` pergunta-o para saber quem esconde o ecrã fixo
 * do sistema: sem abertura, é ele; com ela, é ela, quando as camadas estiverem
 * carregadas (ver `pronta` abaixo).
 */
export function aberturaVaiCorrer(): boolean {
  return !semMovimento();
}

/** Quantas imagens tem de esperar antes de arrancar. */
const N_CAMADAS = 5;
/** Se as imagens não chegarem até aqui, arranca à mesma (o pior é ver menos). */
const ESPERA_MAXIMA = 800;

/** A linha do tempo, em ms desde o arranque. Cada passo fica entre 150 e 750. */
const T = {
  fundo: { em: 0, dura: 420 },
  espigas: { em: 300, dura: 700 },
  cabeca: { em: 1150, dura: 380 },
  pisca: { em: 1750, dura: 260 },
  saida: { em: 2100, dura: 300 },
};

export function Abertura() {
  const [ativa, setAtiva] = useState(() => !semMovimento());
  /*
   * Só arranca com as cinco camadas carregadas. Sem isto, as primeiras
   * centenas de milissegundos passavam com o creme vazio enquanto as imagens
   * chegavam, e o círculo a abrir (o primeiro passo) já tinha acontecido quando
   * se via alguma coisa. Até lá, quem está à vista é o ecrã fixo do sistema,
   * com o logótipo no mesmo sítio: é por isso que ESTA camada o esconde.
   */
  const carregadas = useRef(0);
  const [pronta, setPronta] = useState(false);
  const umaCarregada = () => {
    carregadas.current += 1;
    if (carregadas.current >= N_CAMADAS) setPronta(true);
  };
  useEffect(() => {
    if (!ativa) return;
    const t = setTimeout(() => setPronta(true), ESPERA_MAXIMA);
    return () => clearTimeout(t);
  }, [ativa]);
  useEffect(() => {
    if (pronta || !ativa) void SplashScreen.hideAsync().catch(() => undefined);
  }, [pronta, ativa]);

  const fundo = useRef(new Animated.Value(0)).current;
  const espigas = useRef(new Animated.Value(0)).current;
  const cabeca = useRef(new Animated.Value(0)).current;
  const pisca = useRef(new Animated.Value(0)).current;
  const saida = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ativa || !pronta) return;
    let cancelada = false;
    // O "Reduzir movimento" chega por uma pergunta assíncrona ao sistema, e no
    // arranque a resposta pode ainda não ter vindo: pergunta-se outra vez aqui
    // e, se estiver ligado, a camada some antes de se ver.
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((r) => {
        if (r && !cancelada) setAtiva(false);
      })
      .catch(() => undefined);

    const passo = (v: Animated.Value, para: number, t: { em: number; dura: number }, easing = ABRANDAR, nativo = true) =>
      Animated.timing(v, { toValue: para, duration: t.dura, delay: t.em, easing, useNativeDriver: nativo });

    const tudo = Animated.parallel([
      passo(fundo, 1, T.fundo, Easing.bezier(0.2, 0.8, 0.2, 1)),
      // A altura da janela das espigas não anda no driver nativo (é layout).
      passo(espigas, 1, T.espigas, Easing.bezier(0.3, 0.6, 0.2, 1), false),
      passo(cabeca, 1, T.cabeca, Easing.out(Easing.back(1.6))),
      Animated.sequence([
        Animated.delay(T.pisca.em),
        Animated.timing(pisca, { toValue: 1, duration: T.pisca.dura / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pisca, { toValue: 0, duration: T.pisca.dura / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      passo(saida, 0, T.saida, Easing.in(Easing.quad)),
    ]);
    tudo.start(({ finished }) => {
      if (finished && !cancelada) setAtiva(false);
    });
    return () => {
      cancelada = true;
      tudo.stop();
    };
  }, [ativa, pronta, fundo, espigas, cabeca, pisca, saida]);

  if (!ativa) return null;

  const alturaEspigas = espigas.interpolate({ inputRange: [0, 1], outputRange: [0, TAMANHO] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, estilos.camada, { backgroundColor: colors.background, opacity: saida }]}>
      <View style={estilos.logo}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: fundo,
              transform: [{ scale: fundo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            },
          ]}>
          <Image source={camadas.fundo} style={estilos.imagem} contentFit="contain" onLoad={umaCarregada} />
        </Animated.View>

        {/* As espigas crescem por uma janela que sobe de baixo: a imagem fica
            parada, colada ao fundo, e é a janela que se abre por cima dela. */}
        <Animated.View style={[estilos.janela, { height: alturaEspigas }]}>
          <Image source={camadas.espigaEsq} style={estilos.imagemNoFundo} contentFit="contain" onLoad={umaCarregada} />
          <Image source={camadas.espigaDir} style={estilos.imagemNoFundo} contentFit="contain" onLoad={umaCarregada} />
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: cabeca.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateY: cabeca.interpolate({ inputRange: [0, 1], outputRange: [11, 0] }) },
                { scale: cabeca.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}>
          <Image source={camadas.cabeca} style={estilos.imagem} contentFit="contain" onLoad={umaCarregada} />
          {/* Os olhos à parte, para piscarem. Estão quase à altura do centro
              do logótipo, por isso encolher a camada ao meio fecha-os no sítio. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scaleY: pisca.interpolate({ inputRange: [0, 1], outputRange: [1, 0.1] }) }] },
            ]}>
            <Image source={camadas.olhos} style={estilos.imagem} contentFit="contain" onLoad={umaCarregada} />
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  camada: { zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  logo: { width: TAMANHO, height: TAMANHO },
  imagem: { width: TAMANHO, height: TAMANHO },
  janela: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  imagemNoFundo: { position: 'absolute', left: 0, bottom: 0, width: TAMANHO, height: TAMANHO },
});
