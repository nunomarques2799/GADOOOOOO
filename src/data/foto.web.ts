/**
 * Fotografia do animal — versão WEB/Electron.
 * ------------------------------------------------------------------
 * Sem os módulos nativos: o seletor de ficheiros do navegador (`<input
 * type="file">`) e o `<canvas>` para reduzir a imagem. Na app de computador não
 * há câmara dedicada, por isso o "tirar" e o "escolher" abrem os dois o mesmo
 * seletor (em browsers de telemóvel, o `capture` sugere a câmara).
 *
 * Mesmo contrato da versão nativa: devolve um data URI JPEG de ~600px.
 */

import type { ResultadoFoto } from './foto';

export const suportaCamera = false;

const LARGURA_MAX = 600;
const QUALIDADE = 0.55;

/** Abre o seletor e resolve com o ficheiro, ou `null` se o criador desistir. */
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
    // a UI só fica à espera de uma escolha que não veio.
    input.addEventListener('cancel', () => acabar(null));
    input.click();
  });
}

/** Reduz o ficheiro para um data URI JPEG de largura máxima `LARGURA_MAX`. */
async function reduzir(ficheiro: File): Promise<string> {
  const url = URL.createObjectURL(ficheiro);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Imagem inválida.'));
      im.src = url;
    });
    const escala = Math.min(1, LARGURA_MAX / img.width);
    const largura = Math.round(img.width * escala);
    const altura = Math.round(img.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a fotografia.');
    ctx.drawImage(img, 0, 0, largura, altura);
    return canvas.toDataURL('image/jpeg', QUALIDADE);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function escolher(sugereCamera: boolean): Promise<ResultadoFoto> {
  if (typeof document === 'undefined') return { estado: 'cancelado' };
  const ficheiro = await abrirSeletor(sugereCamera);
  if (!ficheiro) return { estado: 'cancelado' };
  return { estado: 'ok', dataUri: await reduzir(ficheiro) };
}

export function tirarFoto(): Promise<ResultadoFoto> {
  return escolher(true);
}

export function escolherDaGaleria(): Promise<ResultadoFoto> {
  return escolher(false);
}
