/**
 * Escolher o documento a guardar — versão WEB/Electron.
 * ------------------------------------------------------------------
 * Sem módulos nativos: o seletor de ficheiros do navegador e o `<canvas>` para
 * reduzir a imagem. Mesmo contrato da versão nativa — devolve BYTES de um JPEG
 * de ~1600px, prontos a subir para o Storage.
 *
 * Na app de computador não há câmara dedicada, por isso "fotografar" e
 * "escolher" abrem o mesmo seletor (num browser de telemóvel, o `capture`
 * sugere a câmara).
 */

import type { FicheiroEscolhido, ResultadoFicheiro } from './ficheiroDocumento';

export const suportaCamera = false;

const LARGURA_MAX = 1600;
const QUALIDADE = 0.75;

/** Abre o seletor e resolve com o ficheiro, ou `null` se desistirem. */
function abrirSeletor(sugereCamera: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (sugereCamera) input.capture = 'environment';

    let resolvido = false;
    const acabar = (f: File | null) => {
      if (resolvido) return;
      resolvido = true;
      resolve(f);
    };

    input.onchange = () => acabar(input.files?.[0] ?? null);
    // O evento `cancel` existe no Chromium (e portanto no Electron); onde não
    // existir, um ficheiro nunca escolhido deixa a promessa pendente sem mal —
    // a UI fica só à espera de uma escolha que não veio.
    input.addEventListener('cancel', () => acabar(null));
    input.click();
  });
}

/** Reduz para JPEG de largura máxima `LARGURA_MAX` e devolve os bytes. */
async function preparar(ficheiro: File): Promise<FicheiroEscolhido> {
  const url = URL.createObjectURL(ficheiro);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Não foi possível ler a imagem.'));
      im.src = url;
    });
    // Só encolhe. Ampliar uma fotografia pequena não lhe acrescenta detalhe
    // nenhum e triplica o tamanho do ficheiro.
    const escala = Math.min(1, LARGURA_MAX / img.width);
    const largura = Math.round(img.width * escala);
    const altura = Math.round(img.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a imagem.');
    ctx.drawImage(img, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', QUALIDADE),
    );
    if (!blob) throw new Error('Não foi possível preparar a imagem.');

    const bytes = await blob.arrayBuffer();
    return { bytes, mime: 'image/jpeg', extensao: 'jpg', tamanho: bytes.byteLength };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function escolher(sugereCamera: boolean): Promise<ResultadoFicheiro> {
  if (typeof document === 'undefined') return { estado: 'cancelado' };
  const ficheiro = await abrirSeletor(sugereCamera);
  if (!ficheiro) return { estado: 'cancelado' };
  return { estado: 'ok', ficheiro: await preparar(ficheiro) };
}

export function fotografarDocumento(): Promise<ResultadoFicheiro> {
  return escolher(true);
}

export function escolherDocumento(): Promise<ResultadoFicheiro> {
  return escolher(false);
}
