import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalMensagemApoio } from '@/components/ModalMensagemApoio';
import { Button, Card, Header, Icon, Text } from '@/components/ui';
import { EMAIL_APOIO, type TipoMensagem } from '@/data/apoio';
import { reporIntroducoes } from '@/data/introducoes';
import { useToasts } from '@/data/toasts';
import { reporTutorial } from '@/data/tutorial';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/** Perguntas frequentes e formas de contactar o apoio. */
export default function AjudaScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const toast = useToasts();
  /** Que folha está aberta (a de escrever ou a de reportar), ou nenhuma. */
  const [aEscrever, setAEscrever] = useState<TipoMensagem | null>(null);

  function reverGuia() {
    reporTutorial();
    // Também as apresentações dos separadores: quem pede para rever o guia está
    // a pedir que lhe expliquem a app, não só o Início.
    reporIntroducoes();
    toast.info(
      'Guia reposto',
      'Os primeiros passos voltam ao Início e os separadores voltam a apresentar-se.',
    );
    router.navigate('/');
  }

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Ajuda e apoio" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={conteudo}>
          {/* Contactos — a via mais direta fica primeiro, em destaque. */}
          <View>
            <Text
              variant="label"
              color={colors.textSecondary}
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
              PRECISA DE FALAR CONNOSCO?
            </Text>
            <Card>
              <Text variant="body" style={{ marginBottom: spacing.sm }}>
                Escreva-nos com a sua dúvida ou o que aconteceu. Costumamos
                responder no mesmo dia útil.
              </Text>
              {/* O botão abre um formulário aqui dentro, e não o `mailto:` do
                  aparelho: num Android sem conta de correio configurada, o
                  `mailto:` não abre, não falha e não diz nada — quem o carregava
                  ficava convencido de que tinha escrito. */}
              <Button
                label="Enviar mensagem"
                icon="email-fast-outline"
                onPress={() => setAEscrever('apoio')}
              />
              <Text
                variant="caption"
                color={colors.textMuted}
                center
                style={{ marginTop: spacing.sm }}>
                Vai para {EMAIL_APOIO}
              </Text>
            </Card>
          </View>

          {/* Reportar um problema. À parte da mensagem de apoio, e não um
              assunto à escolha lá dentro: quem tem a app a fechar-se não vai
              procurar a palavra certa numa lista — procura o botão que diz o
              que lhe está a acontecer. */}
          <View>
            <Text
              variant="label"
              color={colors.textSecondary}
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
              ALGUMA COISA NÃO FUNCIONA?
            </Text>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name="bug-outline" size="lg" color={colors.warning} />
                <Text variant="body" style={{ flex: 1 }}>
                  Se a app fez algo que não devia (fechou-se, não gravou, mostrou
                  um erro), conte-nos o que estava a fazer. A versão da app e o
                  aparelho seguem sozinhos.
                </Text>
              </View>
              <Button
                label="Reportar um problema"
                icon="bug-outline"
                variant="secondary"
                onPress={() => setAEscrever('bug')}
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          </View>

          <View>
            <Text
              variant="label"
              color={colors.textSecondary}
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
              PERGUNTAS FREQUENTES
            </Text>
            {PERGUNTAS.map((p, i) => (
              <Pergunta key={i} titulo={p.titulo} resposta={p.resposta} />
            ))}
          </View>

          {/* Rever o guia — para quem o escondeu, ou quem quer segui-lo outra
              vez. Volta a mostrar o painel no Início. */}
          <View>
            <Text
              variant="label"
              color={colors.textSecondary}
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
              COMEÇAR DE NOVO
            </Text>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name="flag-checkered" size="lg" color={colors.primary} />
                <Text variant="body" style={{ flex: 1 }}>
                  Voltar a ver o guia de primeiros passos no ecrã inicial e as
                  explicações de cada separador.
                </Text>
              </View>
              <Button
                label="Rever os primeiros passos"
                icon="flag-checkered"
                variant="secondary"
                onPress={reverGuia}
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          </View>
        </View>
      </ScrollView>

      {/* Montada só quando é preciso: fora disso não há folha nenhuma a guardar
          uma mensagem meio escrita de um assunto que já não é o que se quer. */}
      {aEscrever ? (
        <ModalMensagemApoio
          visivel
          tipo={aEscrever}
          onFechar={() => setAEscrever(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * Uma pergunta que se abre.
 * ------------------------------------------------------------------
 * A resposta aparecia e desaparecia de um fotograma para o outro, e o ecrã
 * saltava: quem tinha três perguntas à vista perdia o sítio onde estava a ler.
 * Agora a resposta CRESCE, com o mesmo movimento de mola do acordeão do
 * motion.dev — arranca depressa e assenta com um resto de balanço, em vez de
 * travar a direito. O balanço é o que faz o movimento parecer uma coisa a
 * abrir-se e não uma caixa a ser esticada.
 *
 * A altura da resposta não se sabe de antemão (o texto quebra em mais ou menos
 * linhas conforme o ecrã e o tamanho da letra do sistema), por isso mede-se no
 * `onLayout` e anima-se até ela. É também por isso que a animação não pode
 * passar pelo driver nativo: a altura é uma propriedade de LAYOUT, e o driver
 * nativo só anima o que não obriga a remedir nada.
 */
function Pergunta({ titulo, resposta }: { titulo: string; resposta: string }) {
  const [aberto, setAberto] = useState(false);
  /** A altura natural da resposta, medida com ela já desenhada. */
  const [altura, setAltura] = useState(0);
  const abertura = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(abertura, {
      toValue: aberto ? 1 : 0,
      // Uma mola pouco amortecida (ζ ≈ 0,8): passa um nadinha do sítio e volta.
      // Números maiores no `damping` matam o balanço e dão o "esticar" de antes.
      stiffness: 250,
      damping: 26,
      mass: 1,
      useNativeDriver: false,
    }).start();
  }, [aberto, abertura]);

  return (
    <Card style={{ marginBottom: spacing.sm }} padded={false}>
      <Pressable
        onPress={() => setAberto((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={titulo}
        accessibilityState={{ expanded: aberto }}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.xl,
          },
          pressed && { opacity: 0.6 },
        ]}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {titulo}
        </Text>
        {/* Uma seta só, a rodar. Trocar `chevron-down` por `chevron-up` a meio
            era um salto no meio de um movimento contínuo. */}
        <Animated.View
          style={{
            transform: [
              {
                rotate: abertura.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}>
          <Icon name="chevron-down" size="md" color={colors.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={{
          overflow: 'hidden',
          // `extrapolateLeft: 'clamp'` para o balanço do fecho não passar de
          // zero: uma altura negativa não existe, e o Yoga trata-a como se a
          // resposta ainda lá estivesse. À direita deixa-se passar de propósito
          // — é esse excesso que é o balanço.
          height: abertura.interpolate({
            inputRange: [0, 1],
            outputRange: [0, altura],
            extrapolateLeft: 'clamp',
          }),
          opacity: abertura.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
          // Fechada, a resposta continua desenhada (é assim que se lhe sabe a
          // altura) mas está fora do alcance de toda a gente: o leitor de ecrã
          // não a lê e o dedo não lhe toca. Sem isto, o TalkBack lia as seis
          // respostas seguidas a quem só abriu uma.
          //
          // No `style` e não como propriedade solta: a propriedade está
          // desaconselhada e enche a consola de avisos.
          pointerEvents: aberto ? 'auto' : 'none',
        }}
        // `aria-hidden` e não os dois primos nativos: é o único dos três que o
        // React Native traduz para as três plataformas (na web vira mesmo
        // `aria-hidden`, e no telemóvel o RN converte-o em
        // `accessibilityElementsHidden` e `importantForAccessibility`).
        aria-hidden={!aberto}>
        <View
          onLayout={(e) => setAltura(e.nativeEvent.layout.height)}
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            paddingTop: 0,
          }}>
          <Text variant="body" color={colors.textSecondary}>
            {resposta}
          </Text>
        </View>
      </Animated.View>
    </Card>
  );
}

const PERGUNTAS = [
  {
    titulo: 'Posso usar a app sem internet?',
    resposta:
      'Sim. Todos os dados ficam guardados no dispositivo e a app funciona igual sem rede. Quando a ligação voltar, as alterações são enviadas para o servidor sozinhas.',
  },
  {
    titulo: 'Como identifico um animal (brinco)?',
    resposta:
      'Ao criar ou editar o animal, preencha o campo "Número de identificação". A partir daí a app deixa de mostrar o alerta de identificação em atraso.',
  },
  {
    titulo: 'A app comunica ao SNIRA por mim?',
    resposta:
      'Não. O envio ao SNIRA continua a ser feito no portal oficial. A app avisa-o dos prazos e marca o animal como comunicado quando confirmar.',
  },
  {
    titulo: 'Onde posso descarregar um relatório?',
    resposta:
      'Em Perfil → Descarregar relatório (PDF). Na app de computador é guardado logo em PDF; no browser é guardado como página HTML que pode imprimir para PDF.',
  },
  {
    titulo: 'Onde é que os dados são guardados?',
    resposta:
      'No próprio dispositivo, para funcionar offline. Se tiver sessão iniciada, uma cópia é sincronizada para a sua conta no servidor. Pode descarregar uma cópia de segurança em Perfil → Sincronização e cópia.',
  },
  {
    titulo: 'Como termino a sessão ou apago a conta?',
    resposta:
      'Ambos em Perfil, no fim do ecrã. Terminar sessão volta ao ecrã de entrada e não apaga nada do servidor. Apagar a minha conta abre um ecrã à parte que mostra o que vai desaparecer (se for dono, a exploração vai com a conta, com os animais e o histórico lá dentro) e só avança depois de escrever APAGAR. É definitivo: nem quem gere a aplicação consegue recuperar.',
  },
];
