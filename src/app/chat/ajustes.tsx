import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Avatar, Card, Header, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { iniciais } from '@/data/chat';
import { EMAIL_APOIO } from '@/data/apoio';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { suportaPush } from '@/data/push';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { definirAvisosDeMensagens, useChat } from '@/data/useChat';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * As definições das conversas: avisar (ou não) de mensagens novas, e quem
 * está bloqueado.
 *
 * Vive aqui e não nas Definições da app por uma razão simples: silenciar uma
 * conversa faz-se na conversa, e o interruptor geral tem de estar ao lado
 * desse, senão ficam dois sítios para a mesma pergunta. O caminho é o ícone da
 * roda dentada no topo das Conversas.
 *
 * As REGRAS estão aqui em texto, e não escondidas: a loja da Apple exige que
 * uma app com conversas diga o que não é permitido e por onde se denuncia
 * (diretriz 1.2). O contacto do apoio é o mesmo de sempre.
 */
export default function AjustesChatScreen() {
  const { avisar, bloqueados, desbloquear } = useChat();
  const { nomeDe } = useNomesEquipa();
  const toast = useToasts();

  const [lista, setLista] = useState<string[]>([]);

  useEffect(() => {
    void bloqueados().then(setLista);
  }, [bloqueados]);

  function desbloquearPessoa(id: string) {
    const nome = nomeDe(id) ?? t('chat.utilizadorRemovido');
    void desbloquear(id)
      .then(() => {
        setLista((l) => l.filter((x) => x !== id));
        toast.sucesso(t('chat.desbloqueada'), nome);
      })
      .catch((e) => toast.erro(t('comum.semGravar'), mensagemDeErro(e)));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('chat.ajustes')} />
      <Screen>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="bell-outline" size="md" color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text variant="body">{t('chat.avisarNovas')}</Text>
              {/* Um interruptor para as duas coisas (ver
                  `definirAvisosDeMensagens`), por isso o que ele promete muda
                  com o aparelho: no telemóvel toca com a app fechada, no
                  computador só a mostra enquanto ela está aberta. */}
              <Text variant="caption" color={colors.textSecondary}>
                {suportaPush ? t('chat.avisosNoTelemovelAjuda') : t('chat.avisarNovasAjuda')}
              </Text>
              {!suportaPush ? (
                <Text variant="caption" color={colors.textMuted}>
                  {t('chat.avisosSoNoTelemovel')}
                </Text>
              ) : null}
            </View>
            <Switch
              value={avisar}
              onValueChange={definirAvisosDeMensagens}
              accessibilityLabel={t('chat.avisarNovas')}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        <SectionHeader title={t('chat.verBloqueados')} />
        <Card style={{ marginBottom: spacing.md }}>
          {lista.length === 0 ? (
            <Text variant="secondary" color={colors.textSecondary}>
              {t('chat.semBloqueados')}
            </Text>
          ) : (
            lista.map((id, i) => {
              const nome = nomeDe(id) ?? t('chat.utilizadorRemovido');
              return (
                <View
                  key={id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    minHeight: 60,
                    borderBottomWidth: i < lista.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}>
                  <Avatar initials={iniciais(nome)} size={40} />
                  <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {nome}
                  </Text>
                  <Pressable
                    onPress={() => desbloquearPessoa(id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('chat.desbloquear')}: ${nome}`}
                    hitSlop={8}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Text variant="caption">{t('chat.desbloquear')}</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </Card>

        <SectionHeader title={t('chat.regrasTitulo')} />
        <Card>
          <Text variant="secondary" color={colors.textSecondary}>
            {t('chat.regrasTexto')}
          </Text>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            {EMAIL_APOIO}
          </Text>
        </Card>
      </Screen>
    </View>
  );
}
