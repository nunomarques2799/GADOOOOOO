/**
 * Gera os ícones nativos a partir do ícone da marca.
 * ------------------------------------------------------------------
 * A app nasceu do template do Expo e ficou com os ícones dele: o azul com o
 * símbolo do Expo. A marca já existia — o site e a app instalável (PWA) usam
 * `public/icons/icone-512.png`, a cara de vaca branca sobre verde. Este script
 * leva essa mesma cara para o ícone do telemóvel e para o ecrã de arranque,
 * para a app nativa deixar de se apresentar como uma app do Expo.
 *
 * Correr só quando o ícone da marca mudar:
 *   node scripts/gerar-icones.js
 *
 * Precisa do `jimp-compact`, que já vem com o `@expo/image-utils` do Expo.
 */

const path = require('path');
const Jimp = require('jimp-compact');

const RAIZ = path.join(__dirname, '..');
const ORIGEM = path.join(RAIZ, 'public', 'icons', 'icone-512.png');
const IMAGENS = path.join(RAIZ, 'assets', 'images');

/**
 * Recorta a cara branca do fundo verde.
 *
 * O fundo é um gradiente (não uma cor só), por isso não se pode comparar com um
 * valor fixo. O que separa as duas coisas é que o verde tem o vermelho e o azul
 * baixos e o branco tem-nos aos dois no máximo: `min(r, b)` dá 34 no fundo e 255
 * na cara. Os olhos e a boca (verde-escuro sobre o branco) ficam TRANSPARENTES de
 * propósito — por cima do fundo verde do ícone adaptativo, voltam a aparecer.
 */
function recortarCara(imagem) {
  const PISO = 95; // acima do azul mais claro do gradiente do fundo
  imagem.scan(0, 0, imagem.bitmap.width, imagem.bitmap.height, (x, y, i) => {
    const d = imagem.bitmap.data;
    const alfa = Math.round(((Math.min(d[i], d[i + 2]) - PISO) / (255 - PISO)) * 255);
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = Math.max(0, Math.min(255, alfa));
  });
  return imagem;
}

/** Caixa que envolve o que ficou visível, para o glifo poder ser centrado. */
function caixaVisivel(imagem) {
  const { width, height, data } = imagem.bitmap;
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x: x0, y: y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 };
}

/**
 * O glifo sozinho, centrado numa tela quadrada transparente.
 *
 * `fracao` é quanto do lado da tela o glifo pode ocupar. No ícone adaptativo do
 * Android o sistema corta os cantos e roda a máscara — o que fica de fora dos
 * 66% centrais pode desaparecer, por isso 0,58 deixa margem.
 */
async function glifoCentrado(lado, fracao) {
  const cara = recortarCara(await Jimp.read(ORIGEM));
  const caixa = caixaVisivel(cara);
  const glifo = cara.crop(caixa.x, caixa.y, caixa.largura, caixa.altura);
  const escala = (lado * fracao) / Math.max(caixa.largura, caixa.altura);
  glifo.resize(Math.round(caixa.largura * escala), Math.round(caixa.altura * escala));

  const tela = await new Jimp(lado, lado, 0x00000000);
  return tela.composite(
    glifo,
    Math.round((lado - glifo.bitmap.width) / 2),
    Math.round((lado - glifo.bitmap.height) / 2),
  );
}

async function main() {
  // Ícone da app: o quadrado completo, com o fundo verde. 1024 é o que a App
  // Store exige e o que o Expo espera receber.
  const quadrado = await Jimp.read(ORIGEM);
  await quadrado.resize(1024, 1024).writeAsync(path.join(IMAGENS, 'icone-app.png'));

  // Android adaptativo: só a cara, sobre o verde que vai no `app.json`.
  await (await glifoCentrado(1024, 0.58)).writeAsync(
    path.join(IMAGENS, 'android-icon-foreground.png'),
  );
  await (await glifoCentrado(1024, 0.58)).writeAsync(
    path.join(IMAGENS, 'android-icon-monochrome.png'),
  );

  // Arranque: a cara branca sobre o verde do splash. Fica larga na tela porque
  // o tamanho apresentado é decidido pelo `imageWidth` do `app.json`.
  await (await glifoCentrado(512, 0.92)).writeAsync(
    path.join(IMAGENS, 'splash-terrabovina.png'),
  );

  console.log('Ícones gerados a partir de', path.relative(RAIZ, ORIGEM));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
