import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Header, Icon, Text } from '@/components/ui';
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
              <Button
                label="Enviar email"
                icon="email-outline"
                onPress={() =>
                  void Linking.openURL(
                    'mailto:apoio@gestaogado.pt?subject=' +
                      encodeURIComponent('Ajuda com a Terrabovina'),
                  )
                }
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
    </View>
  );
}

function Pergunta({ titulo, resposta }: { titulo: string; resposta: string }) {
  const [aberto, setAberto] = useState(false);
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
        <Icon name={aberto ? 'chevron-up' : 'chevron-down'} size="md" color={colors.textMuted} />
      </Pressable>
      {aberto ? (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            paddingTop: 0,
          }}>
          <Text variant="body" color={colors.textSecondary}>
            {resposta}
          </Text>
        </View>
      ) : null}
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
      'Em Perfil, na secção "Conta". Terminar sessão volta ao ecrã de entrada. Apagar a conta remove os seus dados de forma definitiva: não é possível voltar atrás.',
  },
];
