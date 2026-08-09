import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Field, Icon, Text, TextField } from '@/components/ui';
import {
  EMAIL_APOIO,
  MAX_TEXTO,
  contextoDoAparelho,
  enviarMensagemApoio,
  problemaComMensagem,
  type TipoMensagem,
} from '@/data/apoio';
import { useToasts } from '@/data/toasts';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, radii, shadow, spacing } from '@/theme';

/**
 * Escrever ao apoio, ou reportar um problema.
 * ------------------------------------------------------------------
 * A mesma folha para as duas coisas, porque é o mesmo gesto: dizer do que se
 * trata e contar o que se passa. O que muda é o título, o exemplo que se dá e a
 * linha de diagnóstico que vai colada ao fim dos problemas — a versão da app e
 * o aparelho, que é a primeira coisa que se pergunta e a que ninguém sabe
 * responder de cabeça.
 *
 * Não é um `mailto:`. O botão anterior abria o correio do aparelho e, num
 * Android sem conta de email configurada, não fazia rigorosamente nada: quem o
 * carregava ficava convencido de que tinha escrito. Aqui o envio é do servidor
 * (`data/apoio.ts`) e a folha diz sempre o que aconteceu.
 */
export function ModalMensagemApoio({
  visivel,
  tipo,
  onFechar,
}: {
  visivel: boolean;
  tipo: TipoMensagem;
  onFechar: () => void;
}) {
  const desktop = useDesktop();
  const toast = useToasts();

  const [assunto, setAssunto] = useState('');
  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  /** Só depois de tentar enviar é que se aponta o que falta. */
  const [tentou, setTentou] = useState(false);

  const eBug = tipo === 'bug';

  // Fechada e reaberta, começa em branco. Sem isto, quem escreveu uma mensagem,
  // desistiu e voltou depois para reportar um problema encontrava a dúvida
  // anterior meio escrita no campo — e enviava-a por engano.
  useEffect(() => {
    if (!visivel) return;
    setAssunto('');
    setTexto('');
    setTentou(false);
  }, [visivel, tipo]);

  const problema = problemaComMensagem(assunto, texto);

  async function enviar() {
    setTentou(true);
    if (problema) return;
    setAEnviar(true);
    const razao = await enviarMensagemApoio(tipo, assunto, texto);
    setAEnviar(false);
    if (razao) {
      toast.erro(eBug ? 'Problema não enviado' : 'Mensagem não enviada', razao);
      return;
    }
    toast.sucesso(
      eBug ? 'Problema enviado' : 'Mensagem enviada',
      'Recebemos. Costumamos responder no mesmo dia útil.',
    );
    onFechar();
  }

  return (
    <Modal
      visible={visivel}
      animationType={desktop ? 'fade' : 'slide'}
      transparent
      onRequestClose={onFechar}>
      <KeyboardAvoidingView
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: desktop ? 'center' : 'flex-end',
          padding: desktop ? spacing.xl : 0,
        }}
        // Só no iOS, como no resto da app: no Android a janela já encolhe
        // sozinha e somar-lhe o `padding` daria o dobro do espaço.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onFechar}
          accessibilityLabel="Fechar"
        />
        <View
          style={{
            backgroundColor: colors.background,
            // Os quatro cantos um a um: na web o atalho `borderRadius` e o
            // canto específico compilam para classes cuja ordem não é garantida.
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderBottomLeftRadius: desktop ? radii.xl : 0,
            borderBottomRightRadius: desktop ? radii.xl : 0,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            maxHeight: desktop ? '100%' : '92%',
            overflow: 'hidden',
            ...(desktop ? shadow.lg : null),
          }}>
          {/* Cabeçalho */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingTop: desktop ? spacing.lg : spacing.md,
              paddingBottom: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
            <Icon
              name={eBug ? 'bug-outline' : 'email-fast-outline'}
              size="lg"
              color={eBug ? colors.warning : colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{eBug ? 'Reportar um problema' : 'Escrever ao apoio'}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Vai para {EMAIL_APOIO}
              </Text>
            </View>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <Icon name="close" size="md" color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg }}>
            <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
              {eBug
                ? 'Conte o que estava a fazer e o que aconteceu. Não precisa de saber termos técnicos: a versão da app e o aparelho seguem sozinhos.'
                : 'Escreva-nos com a sua dúvida ou com o que precisa. Respondemos para o email da sua conta.'}
            </Text>

            <Field label="Assunto" obrigatorio ajuda="Uma linha a dizer do que se trata.">
              <TextField
                value={assunto}
                onChangeText={setAssunto}
                placeholder={eBug ? 'A app fecha ao abrir os animais' : 'Dúvida sobre os alertas'}
                icon="format-title"
              />
            </Field>

            <Field
              label={eBug ? 'O que aconteceu' : 'A sua mensagem'}
              obrigatorio
              ajuda={
                eBug
                  ? 'O que estava a fazer, o que esperava e o que apareceu no ecrã.'
                  : 'Quanto mais concreto, mais depressa lhe respondemos.'
              }>
              <View
                style={{
                  borderRadius: radii.md,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}>
                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  placeholder={
                    eBug
                      ? 'Carreguei em Animais e a app fechou-se sozinha. Aconteceu três vezes esta manhã.'
                      : 'Gostava de saber como…'
                  }
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={MAX_TEXTO}
                  style={{
                    minHeight: 140,
                    textAlignVertical: 'top',
                    fontFamily: 'Nunito_600SemiBold',
                    fontSize: 17,
                    color: colors.text,
                  }}
                />
              </View>
            </Field>

            {eBug ? (
              <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
                Vai junto: {contextoDoAparelho()}
              </Text>
            ) : null}

            {/* O que falta, só depois de se tentar enviar: apontar erros a um
                campo que ainda nem se começou a escrever é ralhar antes do
                tempo. */}
            {tentou && problema ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}>
                <Icon name="alert-circle-outline" size="md" color={colors.danger} />
                <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                  {problema}
                </Text>
              </View>
            ) : null}

            <Button
              label={eBug ? 'Enviar o problema' : 'Enviar mensagem'}
              icon="send"
              onPress={enviar}
              loading={aEnviar}
            />
            <Button
              label="Cancelar"
              variant="secondary"
              onPress={onFechar}
              style={{ marginTop: spacing.sm }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
