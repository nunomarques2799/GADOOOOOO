import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import {
  duracaoCurta,
  horaCurta,
  percentagemDaOpcao,
  totalDeVotos,
  type Mensagem,
  type OpcaoSondagem,
} from '@/data/chat';
import { ligacaoParaAnexo } from '@/data/useChat';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * Uma mensagem, seja do que for.
 *
 * Saiu do ecrã da conversa quando as mensagens deixaram de ser só texto: com
 * fotografia, áudio, localização e sondagem, o ecrã passava de 300 para 700
 * linhas e a parte que interessa (a lista, o campo de escrita) desaparecia no
 * meio de código de desenhar balões.
 *
 * As minhas ficam à direita, as dos outros à esquerda. É a convenção de todas
 * as apps de mensagens, e quem tem 82 anos já a conhece de outras.
 */
export function BalaoMensagem({
  mensagem,
  minha,
  mostrarAutor,
  nome,
  opcoes,
  nomeDe,
  onLongPress,
  onVotar,
  onVerFoto,
}: {
  mensagem: Mensagem;
  minha: boolean;
  mostrarAutor: boolean;
  nome: string;
  /** As respostas, quando é uma sondagem. */
  opcoes?: OpcaoSondagem[];
  nomeDe: (id?: string) => string | undefined;
  onLongPress: () => void;
  onVotar: (opcaoId: string) => void;
  onVerFoto: (caminho: string) => void;
}) {
  const apagada = !!mensagem.apagadaEm;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="text"
      accessibilityLabel={etiqueta(mensagem, minha, nome)}
      style={({ pressed }) => [
        {
          alignSelf: minha ? 'flex-end' : 'flex-start',
          maxWidth: '86%',
          marginBottom: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          backgroundColor: minha ? colors.primaryTint : colors.surface,
          borderWidth: 1,
          borderColor: minha ? colors.primaryTint : colors.border,
        },
        pressed && { opacity: 0.8 },
      ]}>
      {mostrarAutor && !minha ? (
        <Text variant="caption" color={colors.primaryDark} style={{ marginBottom: 2 }}>
          {nome}
        </Text>
      ) : null}

      {apagada ? (
        <Text variant="body" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
          {t('chat.mensagemApagada')}
        </Text>
      ) : (
        <Conteudo
          mensagem={mensagem}
          opcoes={opcoes}
          nomeDe={nomeDe}
          onVotar={onVotar}
          onVerFoto={onVerFoto}
        />
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-end',
          gap: spacing.xxs,
          marginTop: 2,
        }}>
        {mensagem.porEnviar ? (
          <>
            <Icon name="clock-outline" size="xs" color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>
              {t('chat.porEnviar')}
            </Text>
          </>
        ) : (
          <Text variant="caption" color={colors.textMuted}>
            {horaCurta(mensagem.criadoEm)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** O que o leitor de ecrã lê. Uma fotografia não tem texto para ler. */
function etiqueta(m: Mensagem, minha: boolean, nome: string): string {
  const quem = minha ? '' : `${nome}: `;
  if (m.apagadaEm) return `${quem}${t('chat.mensagemApagada')}`;
  if (m.tipo === 'foto') return `${quem}${t('chat.umaFotografia')}. ${m.texto}`.trim();
  if (m.tipo === 'audio')
    return `${quem}${t('chat.umaMensagemDeVoz')}, ${duracaoCurta(m.anexoSegundos)}`;
  if (m.tipo === 'local') return `${quem}${t('chat.umaLocalizacao')}. ${m.texto}`.trim();
  return `${quem}${m.texto}`;
}

function Conteudo({
  mensagem,
  opcoes,
  nomeDe,
  onVotar,
  onVerFoto,
}: {
  mensagem: Mensagem;
  opcoes?: OpcaoSondagem[];
  nomeDe: (id?: string) => string | undefined;
  onVotar: (opcaoId: string) => void;
  onVerFoto: (caminho: string) => void;
}) {
  switch (mensagem.tipo) {
    case 'foto':
      return (
        <>
          <Fotografia caminho={mensagem.anexo} onAbrir={onVerFoto} />
          {mensagem.texto ? (
            <Text variant="body" style={{ marginTop: spacing.xs }}>
              {mensagem.texto}
            </Text>
          ) : null}
        </>
      );
    case 'audio':
      return <Audio caminho={mensagem.anexo} segundos={mensagem.anexoSegundos} />;
    case 'local':
      return <Localizacao mensagem={mensagem} />;
    case 'sondagem':
      return (
        <Sondagem
          pergunta={mensagem.texto}
          opcoes={opcoes ?? []}
          nomeDe={nomeDe}
          onVotar={onVotar}
        />
      );
    default:
      return <Text variant="body">{mensagem.texto}</Text>;
  }
}

/* ------------------------------------------------------------------ *
 *  Fotografia
 * ------------------------------------------------------------------ */

/**
 * O bucket é privado, por isso a imagem não tem endereço fixo: pede-se uma
 * ligação assinada de prazo curto. Enquanto ela não chega fica o lugar dela
 * desenhado, para a conversa não saltar quando a imagem aparecer.
 */
function Fotografia({
  caminho,
  onAbrir,
}: {
  caminho?: string;
  onAbrir: (caminho: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!caminho) return;
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
    <Pressable
      onPress={() => onAbrir(caminho)}
      accessibilityRole="button"
      accessibilityLabel={t('chat.verFoto')}
      style={{
        width: 220,
        height: 220,
        borderRadius: radii.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Icon name="image-outline" size="xl" color={colors.textMuted} />
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 *  Áudio
 * ------------------------------------------------------------------ */

/**
 * Um botão e a duração. Sem onda desenhada nem barra a arrastar: é um recado
 * de vinte segundos, e o que faz falta é ouvi-lo.
 *
 * O `useAudioPlayer` recebe a fonte assim que a ligação assinada chega. Antes
 * disso o botão está desligado, e não escondido: um botão que aparece do nada
 * meio segundo depois faz falhar o toque de quem já lá ia.
 */
function Audio({ caminho, segundos }: { caminho?: string; segundos?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const leitor = useAudioPlayer(url ?? undefined);
  const estado = useAudioPlayerStatus(leitor);

  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    void ligacaoParaAnexo(caminho).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [caminho]);

  const aTocar = estado?.playing === true;

  function alternar() {
    if (!url) return;
    if (aTocar) {
      leitor.pause();
      return;
    }
    // Chegado ao fim, tocar outra vez tem de voltar ao princípio: sem isto, o
    // segundo toque no botão não fazia nada e parecia avariado.
    if (estado?.didJustFinish || (estado?.currentTime ?? 0) >= (estado?.duration ?? 0) - 0.1) {
      leitor.seekTo(0);
    }
    leitor.play();
  }

  const decorridos = aTocar ? Math.round(estado?.currentTime ?? 0) : (segundos ?? 0);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 150 }}>
      <Pressable
        onPress={alternar}
        disabled={!url}
        accessibilityRole="button"
        accessibilityLabel={aTocar ? t('chat.parar') : t('chat.tocar')}
        style={({ pressed }) => [
          {
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: url ? colors.primary : colors.surfaceSunken,
          },
          pressed && { opacity: 0.7 },
        ]}>
        <Icon
          name={aTocar ? 'pause' : 'play'}
          size="md"
          color={url ? colors.onPrimary : colors.textMuted}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Icon name="waveform" size="md" color={colors.textSecondary} />
        <Text variant="caption" color={colors.textSecondary}>
          {duracaoCurta(decorridos)}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Localização
 * ------------------------------------------------------------------ */

/**
 * As coordenadas e um botão que abre o mapa do aparelho.
 *
 * NÃO desenha o mapa dentro do balão: o mapa desta app é um WebView com o
 * Leaflet lá dentro (ver `components/mapa/`), e um WebView por cada mensagem
 * de localização numa conversa com dez delas é o que faz um telemóvel de campo
 * ficar sem memória. Quem quer ver o sítio abre-o onde ele se vê melhor, que é
 * a app de mapas do telemóvel.
 */
function Localizacao({ mensagem }: { mensagem: Mensagem }) {
  const { latitude, longitude } = mensagem;
  if (latitude == null || longitude == null) return null;

  const abrir = () => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(
      () => {
        /* sem app de mapas: não há para onde ir */
      },
    );
  };

  return (
    <>
      <Pressable
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel={t('chat.verNoMapa')}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.xs,
            minWidth: 180,
          },
          pressed && { opacity: 0.7 },
        ]}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.infoTint,
          }}>
          <Icon name="map-marker" size="md" color={colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{t('chat.umaLocalizacao')}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
        </View>
        <Icon name="open-in-new" size="sm" color={colors.textMuted} />
      </Pressable>
      {mensagem.texto ? <Text variant="body">{mensagem.texto}</Text> : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  Sondagem
 * ------------------------------------------------------------------ */

/**
 * A pergunta e as respostas, com a barra de cada uma.
 *
 * Os votos são COM NOME (decisão do criador): por baixo de cada resposta ficam
 * os primeiros nomes de quem a escolheu. Numa equipa de cinco, o voto anónimo
 * é teatro — toda a gente sabe quem falta responder — e o que se quer saber é
 * mesmo quem vem sábado.
 */
function Sondagem({
  pergunta,
  opcoes,
  nomeDe,
  onVotar,
}: {
  pergunta: string;
  opcoes: OpcaoSondagem[];
  nomeDe: (id?: string) => string | undefined;
  onVotar: (opcaoId: string) => void;
}) {
  const total = totalDeVotos(opcoes);

  return (
    <View style={{ minWidth: 220, gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
        <Icon name="poll" size="sm" color={colors.primaryDark} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {pergunta}
        </Text>
      </View>

      {opcoes.map((o) => {
        const pct = percentagemDaOpcao(o, total);
        const quem = o.quem
          .map((id) => (nomeDe(id) ?? '').split(/\s+/)[0])
          .filter(Boolean)
          .join(', ');
        return (
          <Pressable
            key={o.id}
            onPress={() => onVotar(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: o.minha }}
            accessibilityLabel={t('chat.votar', { opcao: o.texto })}
            style={({ pressed }) => [{ paddingVertical: spacing.xxs }, pressed && { opacity: 0.7 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon
                name={o.minha ? 'check-circle' : 'circle-outline'}
                size="sm"
                color={o.minha ? colors.primary : colors.textMuted}
              />
              <Text variant="body" style={{ flex: 1 }} numberOfLines={2}>
                {o.texto}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {o.votos}
              </Text>
            </View>
            {/* A barra é um retângulo dentro de outro: a percentagem é a
                largura do de dentro. Sem biblioteca nenhuma. */}
            <View
              style={{
                height: 6,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceSunken,
                overflow: 'hidden',
                marginTop: 2,
              }}>
              <View
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: o.minha ? colors.primary : colors.borderStrong,
                }}
              />
            </View>
            {quem ? (
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {quem}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      <Text variant="caption" color={colors.textSecondary}>
        {total === 0 ? t('chat.semVotos') : t('chat.votosN', { n: total })}
      </Text>
    </View>
  );
}
