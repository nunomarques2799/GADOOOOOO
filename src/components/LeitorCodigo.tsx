import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components/ui';
import { vibrarSucesso } from '@/data/vibrar';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * Ler o código impresso na caixa do medicamento.
 * ------------------------------------------------------------------
 * O que sai daqui é uma STRING e mais nada. Quem decide o que ela quer dizer é
 * o `data/codigos.ts`, que é lógica pura e testada: este ficheiro só sabe
 * apontar a câmara e não sabe o que é um lote.
 *
 * LÊ TUDO, NÃO SÓ QR, e é a decisão que faz a funcionalidade valer a pena. A
 * pergunta que deu origem a isto foi "dá para ler um QR?", mas o QR quase não
 * aparece em medicamento veterinário: o que está nas caixas é o código de
 * riscas (EAN-13) e, cada vez mais, o Data Matrix. Um leitor limitado a QR
 * ficava bonito e não lia caixa nenhuma.
 *
 * O `require` ESCONDIDO, e porque não é um `import` normal
 *
 * O `expo-camera` é um módulo NATIVO e a app instalada no telemóvel foi
 * construída antes de ele existir. Um `import` no topo rebentava nessa app mal
 * alguém abrisse o formulário de um lote, e uma entrega de JS (`eas update`)
 * passava a partir um ecrã que funcionava. Pedido aqui dentro e com a falha
 * engolida, a app antiga fica apenas SEM o botão de ler, com uma frase a dizer
 * porquê, até ao build seguinte. É o mesmo caminho do `som.ts`, pela mesma
 * razão.
 *
 * Isto obriga a tratar as permissões À MÃO em vez de com o `useCameraPermissions`
 * do módulo: um hook não se pode chamar dentro de um `if`, e o módulo pode não
 * existir. Fica um `useEffect` a pedir a autorização quando o leitor abre, que
 * é também quando faz sentido pedi-la.
 */

/**
 * O que se manda ler. Escolhido, e não "tudo o que o módulo sabe":
 *
 *   `datamatrix` .. o quadrado de pontos. É o único que traz LOTE e VALIDADE.
 *   `qr` .......... as etiquetas que a própria app imprime.
 *   `ean13`/`ean8`/`upc_a`/`upc_e` .. os códigos de riscas das caixas.
 *   `code128`/`code39`/`itf14` ...... riscas de embalagem e de distribuidor.
 *
 * Ficam de fora o `pdf417` (documentos de identificação), o `aztec` (bilhetes)
 * e o `codabar` (bibliotecas e bancos de sangue): nenhum aparece numa caixa de
 * medicamento, e na web cada formato a mais é mais trabalho a cada fotograma,
 * porque lá quem lê é um descodificador em JavaScript e não o sistema.
 */
const FORMATOS = [
  'datamatrix',
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'itf14',
] as const;

/**
 * O pedaço do `expo-camera` que este ficheiro usa.
 *
 * As funções de autorização vivem em `Camera.*` e NÃO no topo do módulo, ao
 * contrário do que o nome delas sugere. Custou uma ida ao pré-visualizador: a
 * guarda do `carregarCamara` procurava-as à cabeça, não as encontrava, e o
 * leitor dizia a toda a gente "precisa de uma versão nova" mesmo com o módulo
 * lá dentro. É a razão de haver um teste só a olhar para esta forma
 * (`__tests__/leitorCodigo.test.ts`): se um dia ela mudar, quem dá o sinal é o
 * `npm test` e não o criador a olhar para um ecrã preto.
 */
type Autorizacao = { granted: boolean; canAskAgain: boolean };

type ModuloCamara = {
  CameraView: React.ComponentType<Record<string, unknown>>;
  Camera: {
    requestCameraPermissionsAsync: () => Promise<Autorizacao>;
    getCameraPermissionsAsync: () => Promise<Autorizacao>;
  };
};

/** O módulo tem tudo o que este ficheiro precisa? */
export function moduloCompleto(mod: unknown): mod is ModuloCamara {
  const m = mod as Partial<ModuloCamara> | null;
  return Boolean(
    m?.CameraView &&
      typeof m.Camera?.requestCameraPermissionsAsync === 'function' &&
      typeof m.Camera?.getCameraPermissionsAsync === 'function',
  );
}

function carregarCamara(): ModuloCamara | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: unknown = require('expo-camera');
    return moduloCompleto(mod) ? mod : null;
  } catch {
    // App construída antes de o módulo existir. Não é erro: é uma versão antiga.
    return null;
  }
}

type Estado =
  | 'a-abrir'
  /** A app instalada não tem o módulo. Só um build novo resolve. */
  | 'sem-modulo'
  | 'sem-permissao'
  | 'pronto'
  /** A câmara existe e recusou-se a arrancar (ocupada, sem lente, sem HTTPS). */
  | 'avariada';

export function LeitorCodigo({
  aberto,
  titulo,
  ajuda,
  onLer,
  onFechar,
}: {
  aberto: boolean;
  titulo: string;
  /** Uma linha por baixo da mira, a dizer o que se está à espera de ler. */
  ajuda?: string;
  /** O que a câmara leu, em cru. Fechar o leitor é com quem chama. */
  onLer: (valor: string) => void;
  onFechar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado>('a-abrir');
  const [lanterna, setLanterna] = useState(false);
  const camaraRef = useRef<ModuloCamara | null>(null);

  /**
   * O travão do disparo repetido. O `onBarcodeScanned` dispara a cada fotograma
   * em que o código estiver à vista, ou seja dezenas de vezes por segundo: sem
   * isto, uma leitura abria dezenas de formulários por cima uns dos outros.
   *
   * É um `ref` e não um `useState` porque tem de valer JÁ, dentro da mesma
   * chamada. Um estado só muda no render seguinte, e nesse intervalo passam
   * mais fotogramas.
   */
  const jaLeu = useRef(false);

  useEffect(() => {
    if (!aberto) {
      jaLeu.current = false;
      setLanterna(false);
      setEstado('a-abrir');
      return;
    }

    let vivo = true;
    const mod = camaraRef.current ?? carregarCamara();
    camaraRef.current = mod;
    if (!mod) {
      setEstado('sem-modulo');
      return;
    }

    void (async () => {
      try {
        // Perguntar primeiro evita o pedido do sistema a quem já autorizou.
        const atual = await mod.Camera.getCameraPermissionsAsync();
        const resposta = atual.granted
          ? atual
          : await mod.Camera.requestCameraPermissionsAsync();
        if (!vivo) return;
        setEstado(resposta.granted ? 'pronto' : 'sem-permissao');
      } catch {
        if (vivo) setEstado('avariada');
      }
    })();

    return () => {
      vivo = false;
    };
  }, [aberto]);

  const aoLer = useCallback(
    (resultado: { data?: string }) => {
      if (jaLeu.current) return;
      const valor = resultado?.data?.trim();
      if (!valor) return;
      jaLeu.current = true;
      // O mesmo sinal de sempre para "correu bem". Com o telemóvel ao sol, o
      // toque no pulso é o que se percebe: ver a mira mudar de cor não chega.
      vibrarSucesso();
      onLer(valor);
    },
    [onLer],
  );

  const Camara = camaraRef.current?.CameraView;

  return (
    <Modal visible={aberto} animationType="slide" onRequestClose={onFechar} transparent={false}>
      {/* Fundo preto e não `colors.background`: é o único ecrã da app que é uma
          janela para o mundo, e uma moldura clara à volta da imagem tira
          contraste àquilo que se está a tentar apontar. */}
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {estado === 'pronto' && Camara ? (
          <Camara
            style={{ flex: 1 }}
            facing="back"
            enableTorch={lanterna}
            barcodeScannerSettings={{ barcodeTypes: [...FORMATOS] }}
            onBarcodeScanned={aoLer}
            onMountError={() => setEstado('avariada')}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            {estado === 'a-abrir' ? (
              <ActivityIndicator size="large" color={colors.white} />
            ) : (
              <Explicacao estado={estado} />
            )}
          </View>
        )}

        {estado === 'pronto' ? <Mira ajuda={ajuda} /> : null}

        {/* Barra de cima: fechar e a lanterna. Por cima da imagem, porque a
            imagem ocupa o ecrã todo de propósito (uma caixa pequena obrigava a
            aproximar o frasco até ele sair de foco). */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing.sm,
            left: spacing.md,
            right: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}>
          <BotaoRedondo icon="close" rotulo={t('comum.fechar')} onPress={onFechar} />
          <Text variant="bodyStrong" color={colors.white} style={{ flex: 1 }} numberOfLines={1}>
            {titulo}
          </Text>
          {estado === 'pronto' ? (
            <BotaoRedondo
              icon={lanterna ? 'flashlight' : 'flashlight-off'}
              rotulo={t('leitor.lanterna')}
              ativo={lanterna}
              onPress={() => setLanterna((v) => !v)}
            />
          ) : null}
        </View>

        {/* A saída para quem não consegue ler. Existe SEMPRE, e não só quando a
            câmara falha: um rótulo riscado, um frasco sem código ou uma caixa
            já deitada fora não são avarias, são o dia a dia da arrecadação, e
            escrever à mão continua a ser um caminho de primeira. */}
        <View
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + spacing.lg,
          }}>
          <Button
            label={t('leitor.escreverAMao')}
            icon="pencil-outline"
            variant="secondary"
            onPress={onFechar}
          />
        </View>
      </View>
    </Modal>
  );
}

/** A mira, e a linha que diz o que se está à espera de ler. */
function Mira({ ajuda }: { ajuda?: string }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <View
        style={{
          width: '72%',
          aspectRatio: 1.35,
          maxWidth: 420,
          borderWidth: 3,
          borderColor: colors.white,
          borderRadius: radii.lg,
          opacity: 0.9,
        }}
      />
      {ajuda ? (
        <View
          style={{
            marginTop: spacing.md,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            maxWidth: '86%',
          }}>
          <Text variant="secondary" color={colors.white} style={{ textAlign: 'center' }}>
            {ajuda}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * O que se diz quando não há imagem. Cada caso tem uma saída diferente, e essa
 * é a razão de não ser tudo "não foi possível abrir a câmara": a app antiga
 * precisa de uma atualização, a autorização recusada resolve-se nas definições
 * do aparelho, e uma câmara ocupada resolve-se a fechar a outra app.
 */
function Explicacao({ estado }: { estado: Estado }) {
  const conteudo =
    estado === 'sem-modulo'
      ? { icon: 'update' as const, titulo: t('leitor.semModuloTitulo'), texto: t('leitor.semModulo') }
      : estado === 'sem-permissao'
        ? { icon: 'camera-off-outline' as const, titulo: t('leitor.semPermissaoTitulo'), texto: t('leitor.semPermissao') }
        : { icon: 'alert-circle-outline' as const, titulo: t('leitor.avariadaTitulo'), texto: t('leitor.avariada') };

  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <Icon name={conteudo.icon} size="xl" color={colors.white} />
      <Text variant="h3" color={colors.white} style={{ textAlign: 'center' }}>
        {conteudo.titulo}
      </Text>
      <Text variant="body" color={colors.white} style={{ textAlign: 'center', opacity: 0.85 }}>
        {conteudo.texto}
      </Text>
    </View>
  );
}

function BotaoRedondo({
  icon,
  rotulo,
  ativo,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  rotulo: string;
  ativo?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: ativo }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ativo ? colors.white : 'rgba(0,0,0,0.45)',
        opacity: pressed ? 0.8 : 1,
      })}>
      <Icon name={icon} size="md" color={ativo ? '#000000' : colors.white} />
    </Pressable>
  );
}

