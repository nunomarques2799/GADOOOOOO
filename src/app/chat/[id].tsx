import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalaoMensagem } from '@/components/chat/BalaoMensagem';
import { FolhaAnexos, type EscolhaAnexo } from '@/components/chat/FolhaAnexos';
import { EcraComTeclado, Header, Icon, Text } from '@/components/ui';
import { avisar, confirmar } from '@/data/avisos';
import {
  agruparPorDia,
  MAX_TEXTO,
  MESES_ATE_APAGAR,
  podeApagarMensagem,
  podeDenunciarMensagem,
  primeiroNome,
  problemaComTexto,
  rotuloDoDia,
  tituloDaConversa,
  type Mensagem,
} from '@/data/chat';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { ligacaoParaAnexo, useChat, useConversa } from '@/data/useChat';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Uma conversa aberta.
 *
 * O que se escreve aparece já no ecrã e sai quando houver rede (ver a decisão
 * 2 no cabeçalho do `useChat.ts`), com a marca de "por enviar" enquanto não
 * sair. É a diferença entre esta app e a agenda, e é de propósito: um recado
 * escreve-se no curral.
 *
 * Os ANEXOS não seguem essa regra: uma fotografia precisa de rede para subir
 * (não há Storage offline), e guardar megabytes numa fila local à espera de
 * ligação enchia o telemóvel sem nada a avisar.
 *
 * NÃO há aviso de "mensagem enviada". A regra da app é que toda a ação que
 * grava dá sinal, e aqui o sinal é a própria mensagem a aparecer na conversa:
 * um toast por mensagem enviada seria um cartão a tapar o ecrã de dez em dez
 * segundos. Quando alguma coisa corre mal, aí sim.
 */
export default function ConversaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversaId = String(id ?? '');
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();

  const {
    conversa,
    mensagens,
    sondagens,
    enviar,
    enviarAnexo,
    enviarLocalizacao,
    criarSondagem,
    votar,
    apagar,
    denunciar,
  } = useConversa(conversaId);
  const { pessoas } = useChat();
  const { nomeDe } = useNomesEquipa();
  const { exploracoes, utilizador } = useGado();
  const toast = useToasts();

  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [escolhida, setEscolhida] = useState<Mensagem | null>(null);
  const [anexosAberto, setAnexosAberto] = useState(false);
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  const exploracao = exploracoes.find((e) => e.id === conversa?.exploracaoId);
  const nomeExploracao = useCallback(
    (expId?: string) => exploracoes.find((e) => e.id === expId)?.nome,
    [exploracoes],
  );

  const titulo = conversa ? tituloDaConversa(conversa, nomeDe, nomeExploracao) : t('chat.titulo');
  const blocos = useMemo(() => agruparPorDia(mensagens), [mensagens]);

  /**
   * Porque é que este ecrã pode não deixar escrever:
   *   - o dono removeu-me do grupo (o servidor diz-mo no `ativa`);
   *   - é uma privada com alguém que já não está ao meu alcance (o prazo do
   *     veterinário acabou, saiu da equipa, ou um de nós bloqueou o outro).
   * A segunda lê-se da lista de quem posso contactar, que vem do MESMO
   * `podem_falar()` que a RLS usa para aceitar a mensagem.
   */
  const foraDoGrupo = !!conversa && conversa.tipo === 'grupo' && !conversa.ativa;
  const semDestinatario =
    !!conversa && conversa.tipo === 'privada' && !pessoas.some((p) => p.id === conversa.outro);
  const podeEscrever = !!conversa && !foraDoGrupo && !semDestinatario;

  async function mandar() {
    const problema = problemaComTexto(texto);
    if (problema) {
      avisar(t('chat.semEnviar'), problema);
      return;
    }
    const guardado = texto;
    // Limpa já: quem escreveu já leu o que escreveu, e um campo que só esvazia
    // depois da resposta do servidor faz duvidar de que tenha ido.
    setTexto('');
    setAEnviar(true);
    try {
      await enviar(guardado);
      scroll.current?.scrollToEnd({ animated: true });
    } catch (e) {
      setTexto(guardado);
      toast.erro(t('chat.semEnviar'), mensagemDeErro(e));
    } finally {
      setAEnviar(false);
    }
  }

  /**
   * O que fazer com o que a folha de anexos devolveu.
   *
   * A LEGENDA é o que estiver escrito no campo quando se junta a fotografia:
   * escrever primeiro e anexar depois é o gesto que sai naturalmente, e obrigar
   * a um segundo campo dentro da folha era uma pergunta a mais.
   */
  async function comAnexo(escolha: EscolhaAnexo) {
    const legenda = texto.trim();
    setAEnviar(true);
    try {
      if (escolha.tipo === 'foto' || escolha.tipo === 'audio') {
        await enviarAnexo(escolha.tipo, escolha.ficheiro, legenda);
      } else if (escolha.tipo === 'local') {
        await enviarLocalizacao(escolha.latitude, escolha.longitude, legenda);
      } else {
        await criarSondagem(escolha.pergunta, escolha.opcoes);
      }
      setTexto('');
      scroll.current?.scrollToEnd({ animated: true });
    } catch (e) {
      toast.erro(t('chat.semAnexo'), mensagemDeErro(e));
    } finally {
      setAEnviar(false);
    }
  }

  function abrirOpcoes(m: Mensagem) {
    if (!podeApagarMensagem(m, utilizador.id) && !podeDenunciarMensagem(m, utilizador.id)) return;
    setEscolhida(m);
  }

  function apagarEscolhida() {
    const m = escolhida;
    setEscolhida(null);
    if (!m) return;
    confirmar(
      t('chat.apagarMensagem'),
      t('chat.confirmarApagar'),
      () => {
        void apagar(m.id)
          .then(() => toast.sucesso(t('chat.mensagemApagada')))
          .catch((e) => toast.erro(t('comum.semEliminar'), mensagemDeErro(e)));
      },
      { rotuloConfirmar: t('comum.eliminar'), destrutivo: true },
    );
  }

  function denunciarEscolhida() {
    const m = escolhida;
    setEscolhida(null);
    if (!m) return;
    confirmar(
      t('chat.denunciar'),
      t('chat.denunciarTexto'),
      () => {
        void denunciar(m.id)
          .then(() => toast.sucesso(t('chat.denunciada'), t('chat.denunciadaDetalhe')))
          .catch((e) => toast.erro(t('comum.semGravar'), mensagemDeErro(e)));
      },
      { rotuloConfirmar: t('chat.denunciar'), destrutivo: true },
    );
  }

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <EcraComTeclado>
      <Header
        title={titulo}
        actionIcon="information-outline"
        onAction={() => router.push(`/chat/info/${conversaId}`)}
      />

      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: spacing.md }}>
        <View style={coluna}>
          {/* O aviso dos seis meses. Fica no TOPO do histórico e não numa
              definição escondida: é onde se percebe porque é que a conversa
              não começa no princípio dos tempos. */}
          <Text
            variant="caption"
            center
            color={colors.textMuted}
            style={{ paddingVertical: spacing.sm }}>
            {t('chat.avisoSeisMeses', { n: MESES_ATE_APAGAR })}
          </Text>

          {mensagens.length === 0 ? (
            <Text
              variant="secondary"
              center
              color={colors.textSecondary}
              style={{ paddingVertical: spacing.xxl }}>
              {t('chat.semMensagens')}
            </Text>
          ) : null}

          {blocos.map((bloco) => (
            <View key={bloco.dia}>
              <Text
                variant="caption"
                center
                color={colors.textMuted}
                style={{ paddingVertical: spacing.sm }}>
                {rotuloDoDia(bloco.dia)}
              </Text>
              {bloco.mensagens.map((m) => (
                <BalaoMensagem
                  key={m.id}
                  mensagem={m}
                  minha={m.autor === utilizador.id}
                  mostrarAutor={conversa?.tipo === 'grupo'}
                  nome={
                    m.autor
                      ? primeiroNome(nomeDe(m.autor) ?? t('chat.utilizadorRemovido'))
                      : t('chat.utilizadorRemovido')
                  }
                  opcoes={sondagens[m.id]}
                  nomeDe={nomeDe}
                  onLongPress={() => abrirOpcoes(m)}
                  onVotar={(opcaoId) => {
                    void votar(m.id, opcaoId).catch((e) =>
                      toast.erro(t('comum.semGravar'), mensagemDeErro(e)),
                    );
                  }}
                  onVerFoto={setFotoAberta}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {podeEscrever ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm,
          }}>
          <View
            style={{
              ...coluna,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: spacing.xs,
              paddingTop: spacing.sm,
            }}>
            <Pressable
              onPress={() => setAnexosAberto(true)}
              disabled={aEnviar}
              accessibilityRole="button"
              accessibilityLabel={t('chat.anexar')}
              style={({ pressed }) => [
                {
                  width: 48,
                  height: 48,
                  borderRadius: radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceSunken,
                },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon name="plus" size="md" color={colors.text} />
            </Pressable>

            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder={t('chat.escrever')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_TEXTO}
              accessibilityLabel={t('chat.escrever')}
              style={{
                flex: 1,
                minHeight: 48,
                maxHeight: 120,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
                fontFamily: 'Nunito_400Regular',
                fontSize: 17,
                color: colors.text,
              }}
            />
            <Pressable
              onPress={mandar}
              disabled={aEnviar || !texto.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('chat.enviar')}
              style={({ pressed }) => [
                {
                  width: 48,
                  height: 48,
                  borderRadius: radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: texto.trim() ? colors.primary : colors.surfaceSunken,
                },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon
                name="send"
                size="md"
                color={texto.trim() ? colors.onPrimary : colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceSunken,
            paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md,
            paddingTop: spacing.md,
          }}>
          <View style={coluna}>
            <Text variant="secondary" center color={colors.textSecondary}>
              {/* Três razões diferentes para o campo de escrita não estar aqui,
                  e as três dizem-se por palavras: uma barra que simplesmente
                  desaparece faz a app parecer avariada. A terceira é a de quem
                  chega por uma ligação guardada a uma conversa que já não
                  existe (a exploração foi apagada, por exemplo). */}
              {!conversa
                ? t('chat.conversaSumiu')
                : foraDoGrupo
                  ? t('chat.foraDoGrupo')
                  : t('chat.semEscrita')}
            </Text>
          </View>
        </View>
      )}

      <FolhaAnexos
        aberto={anexosAberto}
        onFechar={() => setAnexosAberto(false)}
        onEscolher={(escolha) => void comAnexo(escolha)}
        centro={
          exploracao?.latitude != null && exploracao?.longitude != null
            ? { latitude: exploracao.latitude, longitude: exploracao.longitude }
            : undefined
        }
      />

      <FolhaOpcoes
        mensagem={escolhida}
        meuId={utilizador.id}
        onFechar={() => setEscolhida(null)}
        onApagar={apagarEscolhida}
        onDenunciar={denunciarEscolhida}
      />

      <VerFotografia caminho={fotoAberta} onFechar={() => setFotoAberta(null)} />
    </EcraComTeclado>
  );
}

/** A fotografia em grande, por cima de tudo. Toca-se para fechar. */
function VerFotografia({ caminho, onFechar }: { caminho: string | null; onFechar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!caminho) {
      setUrl(null);
      return;
    }
    let vivo = true;
    void ligacaoParaAnexo(caminho).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [caminho]);

  if (!caminho) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onFechar}>
      <Pressable
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel={t('comum.fechar')}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.md,
        }}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={{ width: '100%', height: '80%' }}
            contentFit="contain"
          />
        ) : (
          <Text variant="body" color={colors.textOnDark}>
            {t('comum.aCarregar')}
          </Text>
        )}
      </Pressable>
    </Modal>
  );
}

/** O que se pode fazer a uma mensagem: apagar a minha, denunciar a dos outros. */
function FolhaOpcoes({
  mensagem,
  meuId,
  onFechar,
  onApagar,
  onDenunciar,
}: {
  mensagem: Mensagem | null;
  meuId: string;
  onFechar: () => void;
  onApagar: () => void;
  onDenunciar: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!mensagem) return null;
  const podeApagar = podeApagarMensagem(mensagem, meuId);
  const podeDenunciar = podeDenunciarMensagem(mensagem, meuId);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel={t('comum.fechar')} />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
          }}>
          <Text variant="h3" style={{ marginBottom: spacing.sm }}>
            {t('chat.opcoes')}
          </Text>
          {podeApagar ? (
            <Opcao icone="trash-can-outline" rotulo={t('chat.apagarMensagem')} onPress={onApagar} />
          ) : null}
          {podeDenunciar ? (
            <Opcao icone="flag-outline" rotulo={t('chat.denunciar')} onPress={onDenunciar} />
          ) : null}
          <Opcao icone="close" rotulo={t('comum.cancelar')} onPress={onFechar} />
        </View>
      </View>
    </Modal>
  );
}

function Opcao({
  icone,
  rotulo,
  onPress,
}: {
  icone: 'trash-can-outline' | 'flag-outline' | 'close';
  rotulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 60,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icone} size="md" color={colors.textSecondary} />
      <Text variant="body">{rotulo}</Text>
    </Pressable>
  );
}
