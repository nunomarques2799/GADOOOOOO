import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Badge,
  EmptyState,
  FolhaComTeclado,
  Icon,
  Text,
} from '@/components/ui';
import {
  horaCurta,
  iniciais,
  ordenarConversas,
  resumoDaUltima,
  rotuloPapel,
  tituloDaConversa,
  type Conversa,
  type PessoaChat,
} from '@/data/chat';
import { diaIso } from '@/data/helpers';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useChat } from '@/data/useChat';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * As conversas: o grupo da exploração e as mensagens privadas.
 *
 * A lista mostra tudo o que esta pessoa tem, ordenado pela última mensagem. O
 * grupo é automático (nasce com a exploração e segue a equipa); as privadas
 * abrem-se no botão de cima, e só com quem trabalha nas mesmas explorações.
 *
 * O VETERINÁRIO chega aqui e vê só privadas: o grupo da exploração não é dele
 * (ver `supabase/schema_chat.sql`). Não há ecrã à parte para isso, nem faz
 * falta: a lista dele é a mesma, com menos uma linha.
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { conversas, pessoas, erro, abrirCom } = useChat();
  const { nomeDe } = useNomesEquipa();
  const { exploracoes, utilizador } = useGado();
  const toast = useToasts();

  const [escolherAberto, setEscolherAberto] = useState(false);

  const nomeExploracao = useMemo(
    () => (id?: string) => exploracoes.find((e) => e.id === id)?.nome,
    [exploracoes],
  );

  const lista = useMemo(() => ordenarConversas(conversas), [conversas]);

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  async function escrever(p: PessoaChat) {
    setEscolherAberto(false);
    try {
      const id = await abrirCom(p.id);
      router.push(`/chat/${id}`);
    } catch (e) {
      toast.erro(t('chat.semEnviar'), mensagemDeErro(e));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={{ ...coluna, paddingTop: insets.top + spacing.md, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="display">{t('chat.titulo')}</Text>
              <Text variant="body" color={colors.textSecondary}>
                {t('chat.subtitulo')}
              </Text>
            </View>
            <BotaoRedondo
              icone="cog-outline"
              rotulo={t('chat.ajustes')}
              onPress={() => router.push('/chat/ajustes')}
            />
            <BotaoRedondo
              icone="pencil-plus-outline"
              rotulo={t('chat.novaConversa')}
              destaque
              onPress={() => setEscolherAberto(true)}
            />
          </View>
        </View>

        {erro && lista.length === 0 ? (
          <View style={coluna}>
            <Text variant="secondary" color={colors.danger}>
              {erro}
            </Text>
          </View>
        ) : null}

        {lista.length === 0 ? (
          <View style={coluna}>
            <EmptyState
              icon="chat-outline"
              title={t('chat.semConversas')}
              message={t('chat.semConversasMensagem')}
              actionLabel={pessoas.length > 0 ? t('chat.novaConversa') : undefined}
              onAction={pessoas.length > 0 ? () => setEscolherAberto(true) : undefined}
            />
          </View>
        ) : (
          <View style={coluna}>
            {lista.map((c) => (
              <LinhaConversa
                key={c.id}
                conversa={c}
                meuId={utilizador.id}
                nomeDe={nomeDe}
                nomeExploracao={nomeExploracao}
                onPress={() => router.push(`/chat/${c.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FolhaEscolherPessoa
        aberto={escolherAberto}
        pessoas={pessoas}
        onFechar={() => setEscolherAberto(false)}
        onEscolher={escrever}
      />
    </View>
  );
}

function BotaoRedondo({
  icone,
  rotulo,
  onPress,
  destaque = false,
}: {
  icone: 'cog-outline' | 'pencil-plus-outline';
  rotulo: string;
  onPress: () => void;
  destaque?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: destaque ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: destaque ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icone} size="md" color={destaque ? colors.onPrimary : colors.text} />
    </Pressable>
  );
}

/** Uma linha da lista: quem, o que se disse por último, e quando. */
function LinhaConversa({
  conversa,
  meuId,
  nomeDe,
  nomeExploracao,
  onPress,
}: {
  conversa: Conversa;
  meuId: string;
  nomeDe: (id?: string) => string | undefined;
  nomeExploracao: (id?: string) => string | undefined;
  onPress: () => void;
}) {
  const titulo = tituloDaConversa(conversa, nomeDe, nomeExploracao);
  const porLer = conversa.naoLidas > 0;
  // Uma conversa de hoje mostra a hora; uma de outro dia mostra o dia. A hora
  // de anteontem não diz nada a ninguém.
  const quando =
    diaIso(conversa.ultimaEm) === diaIso(new Date())
      ? horaCurta(conversa.ultimaEm)
      : `${conversa.ultimaEm.slice(8, 10)}/${conversa.ultimaEm.slice(5, 7)}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        porLer ? `${titulo}, ${t('chat.naoLidasN', { n: conversa.naoLidas })}` : titulo
      }
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          minHeight: 72,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Avatar
        icon={conversa.tipo === 'grupo' ? 'account-group' : 'account'}
        initials={conversa.tipo === 'privada' ? iniciais(titulo) : undefined}
        size={48}
      />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {titulo}
          </Text>
          {conversa.silenciada ? (
            <Icon name="bell-off-outline" size="xs" color={colors.textMuted} />
          ) : null}
          <Text variant="caption" color={colors.textMuted}>
            {quando}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text
            variant="secondary"
            numberOfLines={1}
            color={porLer ? colors.text : colors.textSecondary}
            style={{ flex: 1 }}>
            {resumoDaUltima(conversa, meuId, nomeDe)}
          </Text>
          {porLer ? <Badge label={String(conversa.naoLidas)} tone="brand" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * A quem escrever. São as pessoas das minhas explorações e mais ninguém: esta
 * app não tem uma lista de utilizadores da plataforma, e não é para ter.
 */
function FolhaEscolherPessoa({
  aberto,
  pessoas,
  onFechar,
  onEscolher,
}: {
  aberto: boolean;
  pessoas: PessoaChat[];
  onFechar: () => void;
  onEscolher: (p: PessoaChat) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={onFechar}>
      <FolhaComTeclado>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel={t('comum.fechar')} />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
            maxHeight: '80%',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text variant="h3" style={{ flex: 1 }}>
              {t('chat.aQuemEscrever')}
            </Text>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}>
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          {pessoas.length === 0 ? (
            <EmptyState
              icon="account-off-outline"
              title={t('chat.semPessoas')}
              message={t('chat.semPessoasMensagem')}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {pessoas.map((p, i) => (
                <Pressable
                  key={p.id}
                  onPress={() => onEscolher(p)}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.escreverA', { nome: p.nome })}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      minHeight: 64,
                      borderBottomWidth: i < pessoas.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Avatar initials={iniciais(p.nome)} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {p.nome}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {rotuloPapel(p.papel)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size="md" color={colors.textMuted} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </FolhaComTeclado>
    </Modal>
  );
}
