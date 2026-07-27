/**
 * Tirar ou escolher a fotografia de um animal (versão NATIVA).
 * ------------------------------------------------------------------
 * Quem trata do gado conhece os animais de vista, não pelo brinco. Uma foto na
 * ficha e na lista é o maior salto de reconhecimento que a app pode dar.
 *
 * A foto é reduzida a ~600px e gravada como data URI (base64) no próprio campo
 * `fotografia` do animal — decisão tomada com o criador para a fase de testes:
 * não precisa de bucket, de RLS nem de tratar upload de binário na fila offline,
 * e uma foto tirada sem rede sincroniza como qualquer outro campo. Se um dia a
 * app crescer, troca-se este módulo por Supabase Storage sem mexer nos ecrãs —
 * eles só sabem de uma string.
 *
 * A `.web.ts` faz o mesmo com o seletor de ficheiros do navegador.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type ResultadoFoto =
  | { estado: 'ok'; dataUri: string }
  | { estado: 'cancelado' }
  | { estado: 'sem-permissao' };

/** Há câmara dedicada nesta plataforma? (Falso na web/computador.) */
export const suportaCamera = true;

// ~600px de largura e qualidade média chegam para o rosto do animal na lista
// (52px) e no cabeçalho da ficha (88px), e mantêm o data URI nos ~40 KB — um
// tamanho que a linha da base de dados aguenta sem inchar a cache.
const LARGURA_MAX = 600;
const QUALIDADE = 0.55;

/** Reduz e converte para data URI JPEG. É o que encolhe a foto da câmara. */
async function reduzir(uri: string): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);
  contexto.resize({ width: LARGURA_MAX });
  const imagem = await contexto.renderAsync();
  const saida = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: QUALIDADE, base64: true });
  if (!saida.base64) throw new Error('Não foi possível preparar a fotografia.');
  return `data:image/jpeg;base64,${saida.base64}`;
}

const OPCOES: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  // Recorte quadrado: a ficha e a lista mostram a foto num círculo, e deixar o
  // criador enquadrar evita a cara do animal cortada de qualquer maneira.
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

export async function tirarFoto(): Promise<ResultadoFoto> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { estado: 'sem-permissao' };
  const r = await ImagePicker.launchCameraAsync(OPCOES);
  if (r.canceled || !r.assets?.[0]) return { estado: 'cancelado' };
  return { estado: 'ok', dataUri: await reduzir(r.assets[0].uri) };
}

export async function escolherDaGaleria(): Promise<ResultadoFoto> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { estado: 'sem-permissao' };
  const r = await ImagePicker.launchImageLibraryAsync(OPCOES);
  if (r.canceled || !r.assets?.[0]) return { estado: 'cancelado' };
  return { estado: 'ok', dataUri: await reduzir(r.assets[0].uri) };
}
