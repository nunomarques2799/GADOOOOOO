import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

import { DURACAO, NATIVO, semMovimento } from './movimento';

/**
 * Uma folha que sobe do fundo do ecrã (Mais, Ordenar, Registar, filtros…).
 *
 * Antes, cada folha era um \`<Modal animationType="slide">\` com o fundo escuro
 * DENTRO dela, e o fundo subia junto com a folha: parecia um ecrã inteiro a
 * mudar, em vez de uma folha por cima do que lá estava. Aqui o fundo escurece
 * no sítio, em fade, e só a folha sobe, com uma mola curta no fim.
 *
 * Quem chama passa o ESTILO da folha (fundo, cantos, margens) e o conteúdo; o
 * fundo escuro e o tocar fora para fechar são daqui.
 *
 * Ao fechar, a folha desce antes de desaparecer, e continua a mostrar o que
 * tinha: muitas folhas escondem o conteúdo no mesmo instante em que fecham
 * (\`{item ? … : null}\`), e sem isto desciam vazias.
 */
export function Folha({
  visivel,
  onFechar,
  estilo,
  children,
  comTeclado = false,
  fecharAoTocarFora = true,
  centrada = false,
  propsFolha,
}: {
  visivel: boolean;
  onFechar: () => void;
  /** O estilo da folha em si: fundo, cantos, margens, altura máxima. */
  estilo?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Folhas onde se escreve: sobem acima do teclado no iPhone. */
  comTeclado?: boolean;
  fecharAoTocarFora?: boolean;
  /**
   * Um diálogo ao meio do ecrã em vez de uma folha em baixo: é o que três
   * destas janelas são no computador. Aparece em fade, com uma pequena descida,
   * que é o que um diálogo faz; subir do fundo só faz sentido no telemóvel.
   */
  centrada?: boolean;
  /** Para gestos presos à folha (a agenda muda de dia a arrastar para o lado). */
  propsFolha?: ViewProps;
}) {
  const [montada, setMontada] = useState(visivel);
  const [altura, setAltura] = useState(900);
  const fundo = useRef(new Animated.Value(0)).current;
  // 0 = aberta, 1 = lá em baixo, fora do ecrã.
  const posicao = useRef(new Animated.Value(1)).current;
  const ultimo = useRef(children);
  if (visivel) ultimo.current = children;

  useEffect(() => {
    if (visivel) {
      setMontada(true);
      if (semMovimento()) {
        fundo.setValue(1);
        posicao.setValue(0);
        return;
      }
      fundo.setValue(0);
      posicao.setValue(1);
      Animated.parallel([
        Animated.timing(fundo, { toValue: 1, duration: DURACAO.fundo, useNativeDriver: NATIVO }),
        centrada
          ? Animated.timing(posicao, { toValue: 0, duration: DURACAO.fundo, useNativeDriver: NATIVO })
          : Animated.spring(posicao, { toValue: 0, speed: 14, bounciness: 4, useNativeDriver: NATIVO }),
      ]).start();
      return;
    }
    if (!montada) return;
    if (semMovimento()) {
      setMontada(false);
      return;
    }
    Animated.parallel([
      Animated.timing(fundo, { toValue: 0, duration: DURACAO.folhaFechar, useNativeDriver: NATIVO }),
      Animated.timing(posicao, {
        toValue: 1,
        duration: DURACAO.folhaFechar,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: NATIVO,
      }),
    ]).start(({ finished }) => {
      if (finished) setMontada(false);
    });
    // Só a mudança de visível manda aqui; o resto são refs e setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  const Contentor = comTeclado ? KeyboardAvoidingView : View;
  const corDaFolha = StyleSheet.flatten(estilo)?.backgroundColor ?? colors.background;
  const movimentoDaFolha = centrada
    ? {
        opacity: posicao.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateY: posicao.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }],
      }
    : {
        transform: [{ translateY: posicao.interpolate({ inputRange: [0, 1], outputRange: [0, altura] }) }],
      };

  return (
    <Modal
      visible={montada}
      transparent
      animationType="none"
      onRequestClose={onFechar}
      // Sem isto, no Android o botão físico de voltar fecha a app inteira em
      // vez da folha.
      accessibilityViewIsModal>
      <Contentor
        style={
          centrada
            ? { flex: 1, justifyContent: 'center', padding: spacing.xl }
            : { flex: 1, justifyContent: 'flex-end' }
        }
        {...(comTeclado ? { behavior: Platform.OS === 'ios' ? 'padding' : undefined } : {})}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: fundo }]}>
          {fecharAoTocarFora ? (
            <Pressable
              style={{ flex: 1 }}
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}
            />
          ) : null}
        </Animated.View>
        <Animated.View
          {...propsFolha}
          onLayout={(e) => setAltura(Math.max(1, e.nativeEvent.layout.height))}
          style={[estilo, movimentoDaFolha]}>
          {visivel ? children : ultimo.current}
          {/* A "saia": a mola passa um bocadinho do sítio antes de assentar, e
              sem isto via-se uma risca de fundo escuro por baixo da folha. */}
          {centrada ? null : (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, top: '100%', height: 80, backgroundColor: corDaFolha }}
            />
          )}
        </Animated.View>
      </Contentor>
    </Modal>
  );
}
