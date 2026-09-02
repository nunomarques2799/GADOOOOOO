/**
 * Fotografar (ou escolher) o documento a guardar — versão NATIVA.
 * ------------------------------------------------------------------
 * Irmão do `foto.ts`, e diferente dele em três coisas que são todas a mesma:
 * uma fatura tem de se conseguir LER depois.
 *
 *   - sem recorte quadrado — um papel A4 não é quadrado, e cortá-lo corta-lhe
 *     o total;
 *   - 1600px em vez de 600 — a 600px o rosto de um animal reconhece-se e um
 *     número de contribuinte não;
 *   - qualidade mais alta, pela mesma razão.
 *
 * E devolve BYTES, não um data URI: isto vai para o Supabase Storage (ver
 * `supabase/schema_documentos.sql`) e não para uma coluna de texto.
 *
 * Só imagens. Aceitar PDF obrigava ao `expo-document-picker`, que é um módulo
 * nativo novo — e um módulo nativo novo só chega à app instalada depois de um
 * `eas build`, não de um `eas update`. Fotografar o papel é o que se faz de
 * qualquer maneira quando ele está em cima da mesa.
 *
 * A `.web.ts` faz o mesmo com o seletor de ficheiros do navegador.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type FicheiroEscolhido = {
  bytes: ArrayBuffer;
  /** O tipo, para o Storage o servir de volta com o cabeçalho certo. */
  mime: string;
  /** A extensão do ficheiro, sem ponto. */
  extensao: string;
  tamanho: number;
};

export type OpcoesImagem = {
  /** Largura a que a imagem é reduzida. */
  larguraMax?: number;
  /** Compressão do JPEG, de 0 a 1. */
  qualidade?: number;
};

export type ResultadoFicheiro =
  | { estado: 'ok'; ficheiro: FicheiroEscolhido }
  | { estado: 'cancelado' }
  | { estado: 'sem-permissao' };

/** Há câmara dedicada nesta plataforma? (Falso na web/computador.) */
export const suportaCamera = true;

/**
 * Largura a que a imagem é reduzida. 1600px chega para ler os números de uma
 * fatura A4 fotografada de frente, e mantém o ficheiro nos 300-600 KB.
 */
const LARGURA_MAX = 1600;
const QUALIDADE = 0.75;

const OPCOES: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  // Sem `allowsEditing`: o recorte do sistema é quadrado e comia metade da
  // folha. Quem quiser endireitar a fotografia fá-lo antes, na galeria.
  quality: 0.9,
};

/** Reduz, converte para JPEG e devolve os bytes. */
async function preparar(uri: string, o: OpcoesImagem = {}): Promise<FicheiroEscolhido> {
  const contexto = ImageManipulator.manipulate(uri);
  contexto.resize({ width: o.larguraMax ?? LARGURA_MAX });
  const imagem = await contexto.renderAsync();
  const saida = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: o.qualidade ?? QUALIDADE });

  // `fetch` sobre o `file://` que o manipulador devolveu é a via documentada
  // para chegar aos bytes em React Native sem mais um módulo nativo. Não passa
  // por base64 de propósito: converter 500 KB para texto e outra vez para bytes
  // é o dobro da memória, num telemóvel de campo, para chegar ao mesmo sítio.
  const resposta = await fetch(saida.uri);
  const bytes = await resposta.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('Não foi possível ler a fotografia.');

  return { bytes, mime: 'image/jpeg', extensao: 'jpg', tamanho: bytes.byteLength };
}

export async function fotografarDocumento(o?: OpcoesImagem): Promise<ResultadoFicheiro> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { estado: 'sem-permissao' };
  const r = await ImagePicker.launchCameraAsync(OPCOES);
  if (r.canceled || !r.assets?.[0]) return { estado: 'cancelado' };
  return { estado: 'ok', ficheiro: await preparar(r.assets[0].uri, o) };
}

export async function escolherDocumento(o?: OpcoesImagem): Promise<ResultadoFicheiro> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { estado: 'sem-permissao' };
  const r = await ImagePicker.launchImageLibraryAsync(OPCOES);
  if (r.canceled || !r.assets?.[0]) return { estado: 'cancelado' };
  return { estado: 'ok', ficheiro: await preparar(r.assets[0].uri, o) };
}
