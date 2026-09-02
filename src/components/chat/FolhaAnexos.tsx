import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapaLocalizacao } from '@/components/mapa/MapaLocalizacao';
import { Button, FolhaComTeclado, Icon, type IconName, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import { duracaoCurta, MAX_OPCOES, MIN_OPCOES, problemaComSondagem } from '@/data/chat';
import { escolherDocumento, fotografarDocumento, suportaCamera } from '@/data/ficheiroDocumento';
import { useGravador } from '@/data/gravarAudio';
import { t } from '@/i18n';
import { colors, radii, sizes, spacing } from '@/theme';

import type { AnexoParaEnviar } from '@/data/useChat';

/**
 * As imagens do chat são reduzidas a 1200px, e não aos 1600 dos documentos.
 *
 * A diferença é o que se quer ver: uma fatura tem de dar para LER o número de
 * contribuinte, e uma fotografia de conversa ("o portão está assim") tem de dar
 * para perceber o que se passa. A 1200px fica nos 150-300 KB, que é o que
 * permite mandar uma dúzia por semana sem comer o Storage do plano.
 */
const IMAGEM = { larguraMax: 1200, qualidade: 0.7 };

export type EscolhaAnexo =
  | { tipo: 'foto'; ficheiro: AnexoParaEnviar }
  | { tipo: 'audio'; ficheiro: AnexoParaEnviar }
  | { tipo: 'local'; latitude: number; longitude: number }
  | { tipo: 'sondagem'; pergunta: string; opcoes: string[] };

/**
 * O que se pode juntar a uma mensagem.
 *
 * NÃO HÁ DOCUMENTOS aqui, e a ausência é uma decisão do criador: para guardar
 * uma fatura há a aba Documentos, que a arruma numa gaveta da exploração em
 * vez de a deixar perdida numa conversa que se apaga ao fim de seis meses.
 * Também não há vídeo, e a razão é o espaço (ver `schema_chat_anexos.sql`).
 */
export function FolhaAnexos({
  aberto,
  onFechar,
  onEscolher,
  /** Onde o mapa abre quando ainda não há sítio escolhido: a sede da exploração. */
  centro,
}: {
  aberto: boolean;
  onFechar: () => void;
  onEscolher: (escolha: EscolhaAnexo) => void;
  centro?: { latitude: number; longitude: number };
}) {
  const insets = useSafeAreaInsets();
  const [passo, setPasso] = useState<'menu' | 'voz' | 'sitio' | 'sondagem'>('menu');

  function fechar() {
    setPasso('menu');
    onFechar();
  }

  async function comFotografia(daCamara: boolean) {
    const r = daCamara ? await fotografarDocumento(IMAGEM) : await escolherDocumento(IMAGEM);
    if (r.estado === 'sem-permissao') {
      avisar(daCamara ? t('chat.semCamara') : t('chat.semGaleria'), t('chat.semPermissaoAjuda'));
      return;
    }
    if (r.estado !== 'ok') return;
    fechar();
    onEscolher({ tipo: 'foto', ficheiro: r.ficheiro });
  }

  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={fechar}>
      <FolhaComTeclado>
        <Pressable style={{ flex: 1 }} onPress={fechar} accessibilityLabel={t('comum.fechar')} />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
            maxHeight: '88%',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text variant="h3" style={{ flex: 1 }}>
              {t('chat.anexar')}
            </Text>
            <Pressable
              onPress={fechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}>
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          {passo === 'menu' ? (
            <View>
              {suportaCamera ? (
                <Opcao
                  icone="camera-outline"
                  rotulo={t('chat.tirarFoto')}
                  onPress={() => void comFotografia(true)}
                />
              ) : null}
              <Opcao
                icone="image-multiple-outline"
                rotulo={t('chat.escolherFoto')}
                onPress={() => void comFotografia(false)}
              />
              <Opcao
                icone="microphone-outline"
                rotulo={t('chat.gravarVoz')}
                onPress={() => setPasso('voz')}
              />
              <Opcao
                icone="map-marker-outline"
                rotulo={t('chat.marcarSitio')}
                onPress={() => setPasso('sitio')}
              />
              <Opcao
                icone="poll"
                rotulo={t('chat.fazerSondagem')}
                onPress={() => setPasso('sondagem')}
                ultima
              />
            </View>
          ) : null}

          {passo === 'voz' ? (
            <Gravacao
              onPronto={(ficheiro) => {
                fechar();
                onEscolher({ tipo: 'audio', ficheiro });
              }}
              onDesistir={() => setPasso('menu')}
            />
          ) : null}

          {passo === 'sitio' ? (
            <EscolherSitio
              centro={centro}
              onPronto={(latitude, longitude) => {
                fechar();
                onEscolher({ tipo: 'local', latitude, longitude });
              }}
            />
          ) : null}

          {passo === 'sondagem' ? (
            <ComporSondagem
              onPronto={(pergunta, opcoes) => {
                fechar();
                onEscolher({ tipo: 'sondagem', pergunta, opcoes });
              }}
            />
          ) : null}
        </View>
      </FolhaComTeclado>
    </Modal>
  );
}

function Opcao({
  icone,
  rotulo,
  onPress,
  ultima = false,
}: {
  icone: IconName;
  rotulo: string;
  onPress: () => void;
  ultima?: boolean;
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
          borderBottomWidth: ultima ? 0 : 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icone} size="md" color={colors.primary} />
      <Text variant="body" style={{ flex: 1 }}>
        {rotulo}
      </Text>
      <Icon name="chevron-right" size="md" color={colors.textMuted} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 *  Gravar
 * ------------------------------------------------------------------ */

/**
 * Começa a gravar assim que se toca, e para com o botão grande.
 *
 * Não é "manter carregado para falar": quem tem o telemóvel na mão com luvas,
 * ou o pousa em cima de um poste para falar, não consegue manter o dedo no
 * sítio. Começar e parar são dois toques, e ambos são alvos grandes.
 */
function Gravacao({
  onPronto,
  onDesistir,
}: {
  onPronto: (ficheiro: AnexoParaEnviar) => void;
  onDesistir: () => void;
}) {
  const gravador = useGravador();
  const [aTratar, setATratar] = useState(false);

  async function comecar() {
    const ok = await gravador.comecar();
    if (!ok) avisar(t('chat.semMicrofone'), t('chat.semPermissaoAjuda'));
  }

  async function parar() {
    setATratar(true);
    try {
      const ficheiro = await gravador.parar();
      if (!ficheiro) {
        avisar(t('chat.semAnexo'), t('chat.gravacaoCurta'));
        onDesistir();
        return;
      }
      onPronto({ ...ficheiro, segundos: ficheiro.segundos });
    } finally {
      setATratar(false);
    }
  }

  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: gravador.aGravar ? colors.dangerTint : colors.primaryTint,
        }}>
        <Icon
          name={gravador.aGravar ? 'record' : 'microphone'}
          size={48}
          color={gravador.aGravar ? colors.danger : colors.primary}
        />
      </View>

      <Text variant="h2">{duracaoCurta(gravador.segundos)}</Text>
      {gravador.aGravar ? (
        <Text variant="secondary" color={colors.textSecondary}>
          {t('chat.aGravar')}
        </Text>
      ) : null}

      {gravador.aGravar ? (
        <Button
          label={aTratar ? t('chat.aEnviarFicheiro') : t('chat.pararEEnviar')}
          icon="send"
          disabled={aTratar}
          onPress={() => void parar()}
        />
      ) : (
        <Button label={t('chat.gravarVoz')} icon="microphone" onPress={() => void comecar()} />
      )}

      <Button
        label={t('chat.descartar')}
        icon="close"
        variant="ghost"
        onPress={() => {
          void gravador.descartar();
          onDesistir();
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Marcar um sítio
 * ------------------------------------------------------------------ */

/**
 * Um ponto escolhido NO MAPA, e não o GPS do aparelho.
 *
 * A app não tem o `expo-location` e não é por esquecimento: a localização
 * declarada à Apple é a APROXIMADA (o sítio da exploração, escolhido de uma
 * lista), e pedir o GPS obrigava a declarar localização precisa, a pedir mais
 * uma permissão e a explicá-la na revisão. Marcar no mapa responde à pergunta
 * que se faz numa quinta ("é ali, ao pé do bebedouro") sem nada disso.
 */
function EscolherSitio({
  centro,
  onPronto,
}: {
  centro?: { latitude: number; longitude: number };
  onPronto: (latitude: number, longitude: number) => void;
}) {
  const [ponto, setPonto] = useState<{ latitude: number; longitude: number } | null>(null);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
        {t('chat.escolherSitio')}
      </Text>
      <MapaLocalizacao
        latitude={ponto?.latitude ?? centro?.latitude}
        longitude={ponto?.longitude ?? centro?.longitude}
        selecionavel
        onEscolher={(latitude, longitude) => setPonto({ latitude, longitude })}
        altura={280}
      />
      {ponto ? (
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
          {ponto.latitude.toFixed(5)}, {ponto.longitude.toFixed(5)}
        </Text>
      ) : null}
      <Button
        label={t('chat.enviarSitio')}
        icon="send"
        disabled={!ponto}
        style={{ marginTop: spacing.md }}
        onPress={() => {
          if (!ponto) {
            avisar(t('chat.semAnexo'), t('chat.semSitio'));
            return;
          }
          onPronto(ponto.latitude, ponto.longitude);
        }}
      />
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ *
 *  Sondagem
 * ------------------------------------------------------------------ */

function ComporSondagem({
  onPronto,
}: {
  onPronto: (pergunta: string, opcoes: string[]) => void;
}) {
  const [pergunta, setPergunta] = useState('');
  // Nasce com duas linhas, que é o mínimo: uma sondagem com uma resposta é uma
  // afirmação, e obrigar a carregar em "acrescentar" duas vezes antes de poder
  // escrever seja o que for é trabalho por nada.
  const [opcoes, setOpcoes] = useState<string[]>(['', '']);

  function mudar(i: number, valor: string) {
    setOpcoes((a) => a.map((o, j) => (j === i ? valor : o)));
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Campo
        rotulo={t('chat.pergunta')}
        valor={pergunta}
        aoMudar={setPergunta}
        exemplo={t('chat.perguntaExemplo')}
      />
      {opcoes.map((o, i) => (
        <Campo
          key={i}
          rotulo={t('chat.respostaN', { n: i + 1 })}
          valor={o}
          aoMudar={(v) => mudar(i, v)}
        />
      ))}

      {opcoes.length < MAX_OPCOES ? (
        <Button
          label={t('chat.acrescentarResposta')}
          icon="plus"
          variant="ghost"
          onPress={() => setOpcoes((a) => [...a, ''])}
        />
      ) : null}

      <Button
        label={t('chat.enviarSondagem')}
        icon="send"
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          const problema = problemaComSondagem(pergunta, opcoes);
          if (problema) {
            avisar(t('chat.fazerSondagem'), problema);
            return;
          }
          onPronto(
            pergunta.trim(),
            opcoes.map((o) => o.trim()).filter(Boolean),
          );
        }}
      />
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
        {t('chat.sondagemPoucasRespostas', { n: MIN_OPCOES })}
      </Text>
    </ScrollView>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  exemplo,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  exemplo?: string;
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.xxs }}>
        {rotulo}
      </Text>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        placeholder={exemplo}
        placeholderTextColor={colors.textMuted}
        maxLength={300}
        accessibilityLabel={rotulo}
        style={{
          height: sizes.input,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          fontFamily: 'Nunito_400Regular',
          fontSize: 17,
          color: colors.text,
        }}
      />
    </View>
  );
}
