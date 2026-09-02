/**
 * Gerar um código QR, sem dependências e sem rede.
 * ------------------------------------------------------------------
 * Lógica pura: entra texto, sai uma grelha de quadrados pretos e brancos. Quem
 * a desenha é o `components/EtiquetaQR`; quem a manda imprimir é o
 * `data/etiquetas.web.ts`.
 *
 * PORQUE É ESCRITO À MÃO E NÃO UMA BIBLIOTECA
 *
 * As duas hipóteses eram o `react-native-qrcode-svg` (que arrasta o
 * `react-native-svg`, mais um módulo NATIVO e mais um build para toda a gente)
 * e o `qrcode` do npm (pensado para Node, com dependências que não se querem
 * dentro de uma app de telemóvel). O que aqui é preciso é um QR pequeno, de um
 * texto curto, igual no telemóvel, na web e no Windows: 300 linhas de
 * aritmética resolvem isso e não pedem nada a ninguém.
 *
 * A CORREÇÃO DE ERROS É `M` (cerca de 15%), e não a mais alta
 *
 * Uma etiqueta colada num frasco de antibiótico apanha humidade, poeira e
 * dedadas, mas está a dois palmos da câmara e bem iluminada, ao contrário de um
 * cartaz na rua. O nível `M` é o compromisso do costume: aguenta um canto sujo
 * sem obrigar a um símbolo maior, e num frasco de 20 ml cada milímetro conta.
 *
 * ATÉ À VERSÃO 10, E DEPOIS RECUSA
 *
 * A etiqueta desta app leva `TBV1:LOTE:` mais um identificador: 46 caracteres,
 * que cabem numa versão 4 (33x33). O teto da versão 10 dá folga de sobra e
 * poupa as tabelas das 30 versões seguintes, que nunca seriam usadas. Acima
 * disso rebenta com uma mensagem, em vez de devolver um símbolo truncado que
 * ninguém consegue ler e que só se descobre com o leitor na mão.
 *
 * COMO SE SABE QUE ISTO ESTÁ CERTO
 *
 * `__tests__/qr.test.ts` compara a grelha, módulo a módulo, com a de uma
 * biblioteca de referência (`qrcode` do npm, corrida à parte para gerar as
 * amostras). Um QR quase certo é indistinguível de um certo a olho, e só um
 * leitor ou uma comparação dessas dá pela diferença.
 */

/* ------------------------------------------------------------------
 * Aritmética do corpo de Galois GF(256)
 * ------------------------------------------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function tabelas() {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    // 0x11d é o polinómio primitivo que a norma do QR fixa.
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function multiplicar(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** O polinómio gerador de grau `grau`, para a correção de erros. */
function gerador(grau: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < grau; i += 1) {
    const novo = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j += 1) {
      novo[j] ^= g[j];
      novo[j + 1] ^= multiplicar(g[j], EXP[i]);
    }
    g = novo;
  }
  return g;
}

/** Os bytes de correção de erros de um bloco de dados (resto da divisão). */
function correcao(dados: Uint8Array, quantos: number): Uint8Array {
  const g = gerador(quantos);
  const resto = new Uint8Array(dados.length + quantos);
  resto.set(dados);
  for (let i = 0; i < dados.length; i += 1) {
    const coef = resto[i];
    if (coef === 0) continue;
    // Começa no 1 porque o `g[0]` é sempre 1: o termo de cima anula-se sozinho.
    for (let j = 1; j < g.length; j += 1) resto[i + j] ^= multiplicar(g[j], coef);
  }
  return resto.slice(dados.length);
}

/* ------------------------------------------------------------------
 * As tabelas da norma, para o nível de correção M
 * ------------------------------------------------------------------ */

type Versao = {
  /** Bytes totais do símbolo, dados e correção juntos. */
  total: number;
  /** Bytes de correção POR BLOCO. */
  correcaoPorBloco: number;
  /** [quantos blocos, bytes de dados em cada] para cada um dos dois grupos. */
  grupos: [number, number][];
};

const VERSOES: Record<number, Versao> = {
  1: { total: 26, correcaoPorBloco: 10, grupos: [[1, 16]] },
  2: { total: 44, correcaoPorBloco: 16, grupos: [[1, 28]] },
  3: { total: 70, correcaoPorBloco: 26, grupos: [[1, 44]] },
  4: { total: 100, correcaoPorBloco: 18, grupos: [[2, 32]] },
  5: { total: 134, correcaoPorBloco: 24, grupos: [[2, 43]] },
  6: { total: 172, correcaoPorBloco: 16, grupos: [[4, 27]] },
  7: { total: 196, correcaoPorBloco: 18, grupos: [[4, 31]] },
  8: { total: 242, correcaoPorBloco: 22, grupos: [[2, 38], [2, 39]] },
  9: { total: 292, correcaoPorBloco: 22, grupos: [[3, 36], [2, 37]] },
  10: { total: 346, correcaoPorBloco: 26, grupos: [[4, 43], [1, 44]] },
};

/** Onde ficam os padrões de alinhamento, por versão. */
const ALINHAMENTO: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** Quantos bytes de DADOS cabem numa versão (soma dos grupos). */
function capacidade(versao: number): number {
  return VERSOES[versao].grupos.reduce((soma, [blocos, bytes]) => soma + blocos * bytes, 0);
}

/* ------------------------------------------------------------------
 * Do texto aos bytes do símbolo
 * ------------------------------------------------------------------ */

/**
 * UTF-8 escrito à mão, e não `TextEncoder`.
 *
 * O `TextEncoder` existe na web e nos motores recentes, mas isto corre também
 * dentro da app instalada, e uma etiqueta que não sai por causa de uma função
 * em falta é uma avaria que só aparece no telemóvel de outra pessoa.
 */
function paraBytes(texto: string): number[] {
  const saida: number[] = [];
  for (let i = 0; i < texto.length; i += 1) {
    let c = texto.codePointAt(i)!;
    if (c > 0xffff) i += 1; // par substituto: já foi consumido pelo codePointAt
    if (c < 0x80) {
      saida.push(c);
    } else if (c < 0x800) {
      saida.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      saida.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      saida.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    }
  }
  return saida;
}

/** A versão mais pequena onde o texto cabe. */
function versaoParaBytes(bytes: number): number {
  for (let v = 1; v <= 10; v += 1) {
    // 2 bytes de cabeçalho até à versão 9 (4 bits de modo + 8 de contagem),
    // 3 a partir da 10 (a contagem passa a 16 bits).
    const cabecalho = v <= 9 ? 2 : 3;
    if (bytes + cabecalho <= capacidade(v)) return v;
  }
  throw new Error(`Texto demasiado longo para um QR (${bytes} bytes, máximo 268).`);
}

/** Os bytes finais do símbolo: dados e correção, já intercalados. */
function bytesDoSimbolo(bytes: number[], versao: number): Uint8Array {
  const bits: number[] = [];
  const empurrar = (valor: number, quantos: number) => {
    for (let i = quantos - 1; i >= 0; i -= 1) bits.push((valor >> i) & 1);
  };

  empurrar(0b0100, 4); // modo byte
  empurrar(bytes.length, versao <= 9 ? 8 : 16);
  for (const b of bytes) empurrar(b, 8);

  const cabem = capacidade(versao) * 8;
  // Terminador: até quatro zeros, ou menos se já não houver espaço.
  empurrar(0, Math.min(4, cabem - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dados: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j += 1) b = (b << 1) | bits[i + j];
    dados.push(b);
  }
  // Enchimento até encher a versão. Os dois valores são os que a norma fixa.
  const enchimento = [0xec, 0x11];
  for (let i = 0; dados.length < capacidade(versao); i += 1) dados.push(enchimento[i % 2]);

  // Partir em blocos e calcular a correção de cada um.
  const { correcaoPorBloco, grupos } = VERSOES[versao];
  const blocosDados: Uint8Array[] = [];
  const blocosCorrecao: Uint8Array[] = [];
  let lido = 0;
  for (const [quantos, tamanho] of grupos) {
    for (let b = 0; b < quantos; b += 1) {
      const bloco = new Uint8Array(dados.slice(lido, lido + tamanho));
      lido += tamanho;
      blocosDados.push(bloco);
      blocosCorrecao.push(correcao(bloco, correcaoPorBloco));
    }
  }

  /**
   * Intercalar é o que faz a correção de erros valer alguma coisa: um borrão
   * na etiqueta estraga bytes seguidos, e com os blocos escritos em fila esse
   * borrão apagava um bloco inteiro (que é mais do que a correção aguenta).
   * Intercalados, o estrago espalha-se por todos e cada um recupera do seu.
   */
  const saida: number[] = [];
  const maiorDados = Math.max(...blocosDados.map((b) => b.length));
  for (let i = 0; i < maiorDados; i += 1) {
    for (const bloco of blocosDados) if (i < bloco.length) saida.push(bloco[i]);
  }
  for (let i = 0; i < correcaoPorBloco; i += 1) {
    for (const bloco of blocosCorrecao) saida.push(bloco[i]);
  }

  // O `total` da tabela não é decoração: dados e correção TÊM de encher o
  // símbolo ao byte. Uma linha da tabela mal copiada não dá erro nenhum,
  // desenha um QR que não lê, e isso só se descobre com o leitor na mão.
  if (saida.length !== VERSOES[versao].total) {
    throw new Error(
      `Tabela da versão ${versao} errada: ${saida.length} bytes em vez de ${VERSOES[versao].total}.`,
    );
  }
  return new Uint8Array(saida);
}

/* ------------------------------------------------------------------
 * Desenhar a grelha
 * ------------------------------------------------------------------ */

type Grelha = { modulos: boolean[][]; reservado: boolean[][]; lado: number };

function grelhaVazia(lado: number): Grelha {
  const criar = () => Array.from({ length: lado }, () => new Array<boolean>(lado).fill(false));
  return { modulos: criar(), reservado: criar(), lado };
}

/** Os três quadrados dos cantos, com a moldura branca à volta. */
function porFinders(g: Grelha) {
  const cantos = [
    [0, 0],
    [0, g.lado - 7],
    [g.lado - 7, 0],
  ];
  for (const [linha0, coluna0] of cantos) {
    for (let l = -1; l <= 7; l += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const linha = linha0 + l;
        const coluna = coluna0 + c;
        if (linha < 0 || linha >= g.lado || coluna < 0 || coluna >= g.lado) continue;
        const dentro = l >= 0 && l <= 6 && c >= 0 && c <= 6;
        const escuro =
          dentro &&
          ((l === 0 || l === 6 || c === 0 || c === 6) ||
            (l >= 2 && l <= 4 && c >= 2 && c <= 4));
        g.modulos[linha][coluna] = escuro;
        g.reservado[linha][coluna] = true;
      }
    }
  }
}

/** As linhas pontilhadas que dão a escala ao leitor. */
function porTiming(g: Grelha) {
  for (let i = 8; i < g.lado - 8; i += 1) {
    const escuro = i % 2 === 0;
    g.modulos[6][i] = escuro;
    g.reservado[6][i] = true;
    g.modulos[i][6] = escuro;
    g.reservado[i][6] = true;
  }
}

/** Os quadradinhos que endireitam o símbolo quando a etiqueta está torta. */
function porAlinhamento(g: Grelha, versao: number) {
  const pos = ALINHAMENTO[versao];
  for (const linha0 of pos) {
    for (const coluna0 of pos) {
      // Os que caíam em cima dos cantos não se desenham.
      const noCanto =
        (linha0 === 6 && coluna0 === 6) ||
        (linha0 === 6 && coluna0 === g.lado - 7) ||
        (linha0 === g.lado - 7 && coluna0 === 6);
      if (noCanto) continue;
      for (let l = -2; l <= 2; l += 1) {
        for (let c = -2; c <= 2; c += 1) {
          g.modulos[linha0 + l][coluna0 + c] =
            Math.max(Math.abs(l), Math.abs(c)) !== 1;
          g.reservado[linha0 + l][coluna0 + c] = true;
        }
      }
    }
  }
}

/** Guarda o sítio do formato, da versão e do módulo escuro obrigatório. */
function reservarInformacao(g: Grelha, versao: number) {
  for (let i = 0; i < 9; i += 1) {
    g.reservado[8][i] = true;
    g.reservado[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    g.reservado[8][g.lado - 1 - i] = true;
    g.reservado[g.lado - 1 - i][8] = true;
  }
  // O módulo que é sempre escuro, e que não é decoração: sem ele o leitor não
  // acerta no nível de correção.
  g.modulos[4 * versao + 9][8] = true;
  g.reservado[4 * versao + 9][8] = true;

  if (versao >= 7) {
    for (let i = 0; i < 18; i += 1) {
      g.reservado[g.lado - 11 + (i % 3)][Math.floor(i / 3)] = true;
      g.reservado[Math.floor(i / 3)][g.lado - 11 + (i % 3)] = true;
    }
  }
}

/** Escreve os bytes em ziguezague, de baixo para cima e da direita para a esquerda. */
function porDados(g: Grelha, bytes: Uint8Array) {
  let bit = 0;
  const total = bytes.length * 8;
  const proximo = (): boolean => {
    if (bit >= total) return false; // o que sobra fica claro
    const valor = (bytes[bit >> 3] >> (7 - (bit % 8))) & 1;
    bit += 1;
    return valor === 1;
  };

  let subir = true;
  let linha = g.lado - 1;
  for (let coluna = g.lado - 1; coluna > 0; coluna -= 2) {
    // A coluna 6 é a do timing e salta-se por inteiro.
    if (coluna === 6) coluna -= 1;
    for (;;) {
      for (let d = 0; d < 2; d += 1) {
        const c = coluna - d;
        if (!g.reservado[linha][c]) g.modulos[linha][c] = proximo();
      }
      linha += subir ? -1 : 1;
      if (linha < 0 || linha >= g.lado) {
        linha -= subir ? -1 : 1;
        subir = !subir;
        break;
      }
    }
  }
}

/** As oito máscaras da norma. */
const MASCARAS: ((l: number, c: number) => boolean)[] = [
  (l, c) => (l + c) % 2 === 0,
  (l) => l % 2 === 0,
  (_l, c) => c % 3 === 0,
  (l, c) => (l + c) % 3 === 0,
  (l, c) => (Math.floor(l / 2) + Math.floor(c / 3)) % 2 === 0,
  (l, c) => ((l * c) % 2) + ((l * c) % 3) === 0,
  (l, c) => (((l * c) % 2) + ((l * c) % 3)) % 2 === 0,
  (l, c) => (((l + c) % 2) + ((l * c) % 3)) % 2 === 0,
];

/**
 * Quanto é que uma máscara estraga a leitura. Ganha a que estraga menos.
 *
 * As quatro regras são as da norma, e existem todas pela mesma razão: um
 * símbolo com manchas grandes, riscas compridas ou pedaços parecidos com os
 * quadrados dos cantos confunde o leitor, mesmo estando tudo certo por dentro.
 */
function penalizacao(m: boolean[][]): number {
  const n = m.length;
  let total = 0;

  // 1: cinco ou mais iguais seguidos, em linha ou em coluna.
  const linhaOuColuna = (ler: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i += 1) {
      let seguidos = 1;
      for (let j = 1; j < n; j += 1) {
        if (ler(i, j) === ler(i, j - 1)) {
          seguidos += 1;
          if (seguidos === 5) total += 3;
          else if (seguidos > 5) total += 1;
        } else {
          seguidos = 1;
        }
      }
    }
  };
  linhaOuColuna((i, j) => m[i][j]);
  linhaOuColuna((i, j) => m[j][i]);

  // 2: quadrados de 2x2 todos da mesma cor.
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = 0; j < n - 1; j += 1) {
      const v = m[i][j];
      if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) total += 3;
    }
  }

  // 3: o desenho que se parece com o quadrado de um canto.
  const alvo1 = [true, false, true, true, true, false, true, false, false, false, false];
  const alvo2 = [false, false, false, false, true, false, true, true, true, false, true];
  const igual = (ler: (k: number) => boolean, alvo: boolean[]) =>
    alvo.every((v, k) => ler(k) === v);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j + 11 <= n; j += 1) {
      if (igual((k) => m[i][j + k], alvo1) || igual((k) => m[i][j + k], alvo2)) total += 40;
      if (igual((k) => m[j + k][i], alvo1) || igual((k) => m[j + k][i], alvo2)) total += 40;
    }
  }

  // 4: escuro a mais ou a menos. Um símbolo muito claro perde-se no papel.
  let escuros = 0;
  for (const linha of m) for (const v of linha) if (v) escuros += 1;
  const percentagem = (escuros * 100) / (n * n);
  total += Math.floor(Math.abs(percentagem - 50) / 5) * 10;

  return total;
}

/** Os 15 bits do formato (nível de correção + máscara), já com o BCH e o XOR. */
function bitsDoFormato(mascara: number): number {
  const dados = (0b00 << 3) | mascara; // 00 = nível M
  let v = dados << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((v >> i) & 1) v ^= 0x537 << (i - 10);
  }
  return ((dados << 10) | v) ^ 0x5412;
}

/**
 * Escreve o formato nos dois sítios onde ele vive.
 *
 * A ORDEM DOS BITS É DO MAIS ALTO PARA O MAIS BAIXO, e não ao contrário. É a
 * armadilha desta função: escrita ao contrário, o símbolo desenha-se todo,
 * parece um QR perfeito, e nenhum leitor lhe pega. A primeira versão desta
 * app tinha-a invertida e só a comparação com a grelha de referência deu por
 * isso (`__tests__/qr.test.ts`).
 *
 * As duas cópias existem porque o canto de baixo à esquerda de uma etiqueta é
 * o que primeiro se descola do frasco: perdida uma, o leitor ainda lê a outra.
 */
function porFormato(g: Grelha, mascara: number) {
  const bits = bitsDoFormato(mascara);
  const bit = (i: number) => ((bits >> i) & 1) === 1;
  const n = g.lado;

  // Cópia 1, à volta do canto de cima à esquerda.
  for (let i = 0; i <= 5; i += 1) g.modulos[8][i] = bit(14 - i);
  g.modulos[8][7] = bit(8);
  g.modulos[8][8] = bit(7);
  g.modulos[7][8] = bit(6);
  for (let k = 0; k <= 5; k += 1) g.modulos[k][8] = bit(k);

  // Cópia 2, repartida pelos outros dois cantos. O módulo em (n-8, 8) fica de
  // fora: é o escuro obrigatório, e é por isso que esta metade tem sete
  // módulos em coluna e oito em linha, em vez de oito e oito.
  for (let i = 0; i <= 6; i += 1) g.modulos[n - 1 - i][8] = bit(14 - i);
  for (let j = 0; j <= 7; j += 1) g.modulos[8][n - 8 + j] = bit(7 - j);
}

function porVersao(g: Grelha, versao: number) {
  if (versao < 7) return;
  let v = versao << 12;
  for (let i = 17; i >= 12; i -= 1) {
    if ((v >> i) & 1) v ^= 0x1f25 << (i - 12);
  }
  const bits = (versao << 12) | v;
  for (let i = 0; i < 18; i += 1) {
    const ligado = ((bits >> i) & 1) === 1;
    g.modulos[g.lado - 11 + (i % 3)][Math.floor(i / 3)] = ligado;
    g.modulos[Math.floor(i / 3)][g.lado - 11 + (i % 3)] = ligado;
  }
}

/* ------------------------------------------------------------------
 * A entrada deste módulo
 * ------------------------------------------------------------------ */

/**
 * A grelha de um código QR: `true` é quadrado escuro.
 *
 * Vem SEM a margem branca à volta (a "zona de silêncio"). Ela é obrigatória
 * para o símbolo ser legível, mas é assunto de quem desenha: no ecrã é o
 * espaçamento do cartão, no papel é a margem da etiqueta, e devolvê-la aqui
 * dentro obrigava toda a gente a contornar quadrados vazios.
 */
export function matrizQr(texto: string): boolean[][] {
  if (!texto) throw new Error('Não há texto para pôr no código QR.');

  const bytes = paraBytes(texto);
  const versao = versaoParaBytes(bytes.length);
  const dados = bytesDoSimbolo(bytes, versao);

  const base = grelhaVazia(21 + (versao - 1) * 4);
  porFinders(base);
  porTiming(base);
  porAlinhamento(base, versao);
  reservarInformacao(base, versao);
  porDados(base, dados);

  // As oito máscaras, e ganha a menos penalizada. É o único sítio onde há
  // trabalho a mais de propósito: são oito grelhas inteiras, mas são 33x33.
  let melhor: boolean[][] | null = null;
  let melhorNota = Number.POSITIVE_INFINITY;
  for (let mascara = 0; mascara < 8; mascara += 1) {
    const g: Grelha = {
      lado: base.lado,
      reservado: base.reservado,
      modulos: base.modulos.map((linha, l) =>
        linha.map((v, c) => (base.reservado[l][c] ? v : v !== MASCARAS[mascara](l, c))),
      ),
    };
    porFormato(g, mascara);
    porVersao(g, versao);
    const nota = penalizacao(g.modulos);
    if (nota < melhorNota) {
      melhorNota = nota;
      melhor = g.modulos;
    }
  }
  return melhor!;
}

/**
 * A grelha em linhas de segmentos seguidos da mesma cor.
 *
 * Existe para desenhar: um símbolo de versão 4 tem 1089 quadrados, e uma vista
 * por quadrado põe o telemóvel de joelhos. Por segmentos são umas centenas, e o
 * resultado no ecrã é exatamente o mesmo.
 */
export function segmentosQr(matriz: boolean[][]): { escuro: boolean; quantos: number }[][] {
  return matriz.map((linha) => {
    const segmentos: { escuro: boolean; quantos: number }[] = [];
    for (const v of linha) {
      const ultimo = segmentos[segmentos.length - 1];
      if (ultimo && ultimo.escuro === v) ultimo.quantos += 1;
      else segmentos.push({ escuro: v, quantos: 1 });
    }
    return segmentos;
  });
}
