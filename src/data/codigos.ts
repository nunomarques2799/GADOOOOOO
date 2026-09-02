/**
 * O que está impresso na caixa do medicamento, lido pela câmara.
 * ------------------------------------------------------------------
 * Lógica pura, sem React, sem câmara e sem rede, para poder ser testada. Quem
 * aponta a câmara é o `components/LeitorCodigo`; o que ele traz é uma STRING, e
 * é aqui que se decide o que ela quer dizer.
 *
 * O QUE ESTÁ MESMO NAS CAIXAS (e não é o que se espera)
 *
 * A pergunta que deu origem a isto foi "dá para ler um QR?". Dá, mas os QR quase
 * não aparecem em medicamento veterinário. O que aparece é:
 *
 *   EAN-13 ......... o código de barras de riscas de sempre. É UM NÚMERO e mais
 *                    nada: não traz nome, não traz lote, não traz validade.
 *   Data Matrix GS1  o quadrado de pontos. Esse traz CAMPOS IDENTIFICADOS, e
 *                    dois deles são exatamente o que custa a escrever à mão com
 *                    o frasco na outra mão: o LOTE `(10)` e a VALIDADE `(17)`.
 *
 * Não há base de dados pública e gratuita que converta um número no nome do
 * medicamento veterinário português (as que existem são comerciais). Por isso a
 * app não pergunta a ninguém: GUARDA O CÓDIGO no lote que se registou, e da
 * segunda compra do mesmo produto em diante reconhece-o sozinha. O catálogo é
 * da exploração e constrói-se a usar, sem custo nenhum e sem rede.
 *
 * A CHAVE É SEMPRE GTIN-14, e é essa a razão de ser do `chave`
 *
 * O mesmo produto lido de riscas dá 13 dígitos e lido do Data Matrix dá 14 (o
 * `(01)`), porque um GTIN-14 é um EAN-13 com um zero à frente. Guardar o que se
 * leu, tal e qual, fazia a app não reconhecer no Data Matrix o produto que já
 * conhecia das riscas. Normaliza-se aos 14 e o problema desaparece.
 *
 * AS ETIQUETAS DA PRÓPRIA APP
 *
 * O quarto tipo não vem de fabricante nenhum: é o QR que a app imprime para se
 * colar no frasco (`data/qr.ts`). Esse aponta para uma linha concreta da
 * arrecadação, e é o único que identifica um LOTE em vez de um produto.
 */

import type { Medicamento } from './types';

/** Onde é que o código foi buscar o significado. */
export type TipoCodigo =
  /** Data Matrix (ou QR) com campos identificados: traz lote e validade. */
  | 'gs1'
  /** Código de riscas: um número e mais nada. */
  | 'ean'
  /** Etiqueta impressa pela própria app: aponta para um lote. */
  | 'interno'
  /** Leu-se alguma coisa que não se sabe interpretar. Guarda-se na mesma. */
  | 'texto';

export type CodigoLido = {
  /** Exatamente o que a câmara devolveu, sem tocar. */
  bruto: string;
  tipo: TipoCodigo;
  /**
   * Com que chave se procura o produto na memória da conta. GTIN-14 quando há
   * número de produto; para o resto, o próprio texto lido.
   */
  chave: string;
  /** `(10)`. Só o Data Matrix GS1 o traz. */
  lote?: string;
  /** `(17)`, já em ISO aaaa-mm-dd. */
  validade?: string;
  /** `(21)`, o número de série do frasco. Guarda-se, não se usa. */
  serie?: string;
  /** Só nas etiquetas da app: o `id` do lote a que a etiqueta pertence. */
  loteId?: string;
};

/* ------------------------------------------------------------------
 * Etiquetas impressas pela app
 * ------------------------------------------------------------------ */

/**
 * O que vai dentro do QR que a app imprime.
 *
 * Texto curto e com versão à cabeça, e não um endereço `https://`, por três
 * razões: cabe num QR pequeno (que é o que se consegue colar num frasco de
 * 20 ml), lê-se sem rede nenhuma, e não manda ninguém para um site se a
 * etiqueta for lida pela câmara do telemóvel em vez de pela app. O `1` é a
 * versão do formato: se um dia mudar o que lá vai dentro, as etiquetas já
 * coladas continuam a ser lidas por este ramo.
 */
export const PREFIXO_ETIQUETA = 'TBV1:LOTE:';

/** O texto a codificar no QR de um lote. */
export function etiquetaDeLote(id: string): string {
  return `${PREFIXO_ETIQUETA}${id}`;
}

/** O `id` do lote, se o que se leu for uma etiqueta desta app. */
export function loteDaEtiqueta(valor: string): string | undefined {
  const limpo = valor.trim();
  if (!limpo.toUpperCase().startsWith(PREFIXO_ETIQUETA)) return undefined;
  const id = limpo.slice(PREFIXO_ETIQUETA.length).trim();
  return id || undefined;
}

/* ------------------------------------------------------------------
 * GS1: os campos identificados do Data Matrix
 * ------------------------------------------------------------------ */

/**
 * Identificadores de comprimento FIXO. O número é o do CONTEÚDO, sem contar os
 * dois dígitos do identificador.
 */
const AI_FIXO: Record<string, number> = {
  '00': 18, // SSCC (a palete)
  '01': 14, // GTIN, o produto. É este que interessa.
  '02': 14, // GTIN do conteúdo de uma caixa agrupada
  '11': 6, // data de fabrico
  '12': 6, // data de vencimento (comercial)
  '13': 6, // data de embalamento
  '15': 6, // consumir de preferência antes de
  '16': 6, // data de venda
  '17': 6, // VALIDADE. É este e o `10` que poupam trabalho ao criador.
  '20': 2, // variante do produto
};

/**
 * Identificadores de comprimento VARIÁVEL, com o máximo que a norma permite.
 * Terminam no separador (FNC1) ou no fim do texto.
 */
const AI_VARIAVEL: Record<string, number> = {
  '10': 20, // LOTE
  '21': 20, // número de série
  '22': 20, // dados do consumidor
  '30': 8, // quantidade
  '37': 8, // número de unidades
};

/**
 * O separador de campos (FNC1). O leitor entrega-o como GS (0x1D); há
 * aparelhos que o dão como `<GS>` escrito por extenso, e o Data Matrix
 * impresso por vezes traz-lhe à frente um identificador de simbologia (`]d2`).
 */
const SEPARADOR = String.fromCharCode(29);

/** Tira o identificador de simbologia que alguns leitores põem à cabeça. */
function semSimbologia(valor: string): string {
  return valor.replace(/^\](?:d2|C1|Q3|e0|d1)/i, '');
}

/**
 * A forma com parênteses (`(01)05601234567893(17)271231(10)AB12`) é a que se
 * imprime por baixo do símbolo, e é também a que alguns leitores devolvem.
 * Converte-se à forma de máquina para haver um só caminho a seguir.
 */
function deParentesesParaCru(valor: string): string | null {
  if (!/^\(\d{2,4}\)/.test(valor)) return null;
  const partes = valor.split(/\((\d{2,4})\)/).filter((p) => p !== '');
  if (partes.length < 2) return null;
  let cru = '';
  for (let i = 0; i < partes.length; i += 2) {
    const ai = partes[i];
    const conteudo = partes[i + 1] ?? '';
    // O separador entra a seguir a todos os de comprimento variável menos o
    // último: sem ele, o lote comia a validade que vinha a seguir.
    const variavel = AI_FIXO[ai] === undefined;
    cru += ai + conteudo + (variavel && i + 2 < partes.length ? SEPARADOR : '');
  }
  return cru;
}

/**
 * Uma data GS1 (`AAMMDD`) em ISO `aaaa-mm-dd`.
 *
 * O SÉCULO não vem no código: `271231` tanto pode ser 1927 como 2027. A norma
 * resolve isto pela janela dos 50 anos à volta do ano atual, e é o que se faz
 * aqui. Sem isso, a validade de um frasco comprado hoje ficava em 1927 e a app
 * dizia que estava estragado.
 *
 * O DIA pode vir a `00`, e quer dizer "o último do mês" (é o que está impresso
 * em quase todas as caixas: "12/2027"). Escrever dia 0 dava data inválida.
 */
export function dataGs1ParaIso(gs1: string, anoAtual = new Date().getFullYear()): string | undefined {
  if (!/^\d{6}$/.test(gs1)) return undefined;
  const aa = Number(gs1.slice(0, 2));
  const mes = Number(gs1.slice(2, 4));
  const dia = Number(gs1.slice(4, 6));
  if (mes < 1 || mes > 12) return undefined;

  let ano = Math.floor(anoAtual / 100) * 100 + aa;
  if (ano - anoAtual > 50) ano -= 100;
  if (anoAtual - ano > 49) ano += 100;

  const ultimo = ultimoDiaDoMes(ano, mes);
  const diaFinal = dia === 0 ? ultimo : dia;
  if (diaFinal < 1 || diaFinal > ultimo) return undefined;

  const p = (n: number) => String(n).padStart(2, '0');
  return `${ano}-${p(mes)}-${p(diaFinal)}`;
}

/**
 * Conta feita à mão e não com `new Date`, de propósito: uma data construída a
 * partir de um `Date` traz o fuso do aparelho atrás, e a validade de um
 * medicamento é um DIA, não um instante (a mesma razão do `diaIso` em
 * `helpers.ts`).
 */
function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === 2) return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

type CamposGs1 = { gtin?: string; lote?: string; validade?: string; serie?: string };

/**
 * Lê os campos de uma cadeia GS1 crua.
 *
 * Ao encontrar um identificador que não conhece, PARA em vez de adivinhar. Um
 * identificador desconhecido tem comprimento desconhecido, e continuar a
 * cortar às cegas dava um lote com pedaços do campo seguinte lá dentro. Os
 * quatro que interessam (`01`, `17`, `10`, `21`) vêm por esta ordem e à
 * cabeça, portanto parar a meio custa o que não se usa.
 */
function lerGs1(cru: string, anoAtual?: number): CamposGs1 | null {
  const campos: CamposGs1 = {};
  let i = 0;
  let lidos = 0;

  while (i < cru.length) {
    // Um separador solto entre campos: salta-se.
    if (cru[i] === SEPARADOR) {
      i += 1;
      continue;
    }
    const ai = cru.slice(i, i + 2);
    if (!/^\d{2}$/.test(ai)) break;

    const fixo = AI_FIXO[ai];
    if (fixo !== undefined) {
      const conteudo = cru.slice(i + 2, i + 2 + fixo);
      if (conteudo.length < fixo) break;
      if (ai === '01') campos.gtin = conteudo;
      if (ai === '17') campos.validade = dataGs1ParaIso(conteudo, anoAtual);
      i += 2 + fixo;
      lidos += 1;
      continue;
    }

    const maximo = AI_VARIAVEL[ai];
    if (maximo === undefined) break;
    const fim = cru.indexOf(SEPARADOR, i + 2);
    const conteudo = (fim === -1 ? cru.slice(i + 2) : cru.slice(i + 2, fim)).slice(0, maximo);
    if (ai === '10') campos.lote = conteudo || undefined;
    if (ai === '21') campos.serie = conteudo || undefined;
    i = fim === -1 ? cru.length : fim + 1;
    lidos += 1;
  }

  return lidos > 0 ? campos : null;
}

/* ------------------------------------------------------------------
 * Números de produto
 * ------------------------------------------------------------------ */

/**
 * O número do produto sempre com 14 dígitos.
 *
 * Um EAN-13 e o GTIN-14 do mesmo produto diferem por um zero à frente, e é essa
 * a razão de isto existir: sem normalizar, a app não reconhecia no Data Matrix
 * o produto que já tinha aprendido do código de riscas.
 */
export function normalizarGtin(numero: string): string | undefined {
  const so = numero.replace(/\D/g, '');
  // 8 (EAN-8), 12 (UPC-A), 13 (EAN-13) e 14 (GTIN-14) são os comprimentos que
  // uma caixa de medicamento pode trazer. O resto não é número de produto.
  if (![8, 12, 13, 14].includes(so.length)) return undefined;
  return so.padStart(14, '0');
}

/* ------------------------------------------------------------------
 * A entrada deste módulo
 * ------------------------------------------------------------------ */

/**
 * O que a câmara leu, já interpretado.
 *
 * Nunca falha: o que não se souber ler fica como `'texto'` e guarda-se na
 * mesma. É deliberado. Um código que a app não percebe continua a servir de
 * chave para reconhecer o mesmo frasco da próxima vez, e recusá-lo obrigava o
 * criador a escrever tudo à mão sem perceber porquê.
 */
export function analisarCodigo(bruto: string, anoAtual?: number): CodigoLido {
  const limpo = bruto.trim();

  const loteId = loteDaEtiqueta(limpo);
  if (loteId) return { bruto: limpo, tipo: 'interno', chave: limpo, loteId };

  const semId = semSimbologia(limpo);
  const cru = deParentesesParaCru(semId) ?? semId;

  // Só vale a pena tentar o GS1 se o texto tiver ar disso: começa por um
  // identificador conhecido e é comprido. Sem esta guarda, um EAN-13 que por
  // acaso comece em "17" era lido como uma validade.
  const pareceGs1 =
    /^(01|00|02|10|11|17|21)/.test(cru) &&
    (cru.includes(SEPARADOR) || cru.length > 14 || /^\(\d{2,4}\)/.test(semId));

  if (pareceGs1) {
    const campos = lerGs1(cru, anoAtual);
    if (campos && (campos.gtin || campos.lote || campos.validade)) {
      const chave = campos.gtin ? (normalizarGtin(campos.gtin) ?? campos.gtin) : limpo;
      return {
        bruto: limpo,
        tipo: 'gs1',
        chave,
        lote: campos.lote,
        validade: campos.validade,
        serie: campos.serie,
      };
    }
  }

  const gtin = /^\d+$/.test(limpo) ? normalizarGtin(limpo) : undefined;
  if (gtin) return { bruto: limpo, tipo: 'ean', chave: gtin };

  return { bruto: limpo, tipo: 'texto', chave: limpo };
}

/* ------------------------------------------------------------------
 * A memória de produtos da conta
 * ------------------------------------------------------------------ */

/**
 * O que se copia de um lote antigo para uma entrada nova do MESMO produto.
 *
 * Repara no que NÃO está aqui: quantidade, lote, validade, custo e data da
 * compra. São o que muda de frasco para frasco, e propô-los preenchidos com os
 * da compra anterior era pôr a app a mentir sobre a arrecadação. O que se
 * herda é a identidade do produto (nome, tipo, unidade) e o que vem da bula (o
 * intervalo de segurança), que não mudam entre compras.
 */
export type ProdutoConhecido = {
  nome: string;
  tipo: Medicamento['tipo'];
  unidade: string;
  intervaloSegurancaDias: number;
  fornecedor?: string;
  /** De que lote se copiou. Serve para o aviso dizer de onde veio. */
  origem: Medicamento;
};

/**
 * Já se registou este código alguma vez? Se sim, com que produto?
 *
 * Procura em toda a conta e não só na exploração aberta, mas dá PREFERÊNCIA à
 * exploração aberta quando há lotes das duas: quem tem duas quintas compra o
 * mesmo antibiótico para as duas, e o fornecedor costuma ser o de cada uma.
 * Dentro do mesmo grupo ganha a compra mais recente, que é a que tem os dados
 * mais parecidos com os de hoje.
 */
export function produtoConhecido(
  chave: string,
  medicamentos: Medicamento[],
  exploracaoId?: string,
): ProdutoConhecido | undefined {
  const iguais = medicamentos.filter((m) => m.codigoBarras && m.codigoBarras === chave);
  if (iguais.length === 0) return undefined;

  const melhor = [...iguais].sort((a, b) => {
    const casaA = exploracaoId != null && a.exploracaoId === exploracaoId;
    const casaB = exploracaoId != null && b.exploracaoId === exploracaoId;
    if (casaA !== casaB) return casaA ? -1 : 1;
    return b.dataCompra.localeCompare(a.dataCompra);
  })[0];

  return {
    nome: melhor.nome,
    tipo: melhor.tipo,
    unidade: melhor.unidade,
    intervaloSegurancaDias: melhor.intervaloSegurancaDias,
    fornecedor: melhor.fornecedor,
    origem: melhor,
  };
}

/**
 * Onde é que este código vai dar dentro da app.
 *
 * É a decisão que o botão de ler toma a seguir à leitura, e vive aqui em vez de
 * dentro do ecrã para poder ser testada sem câmara nenhuma:
 *
 *   `lote` ..... a etiqueta da app, ou um Data Matrix cujo LOTE já está
 *                registado. Abre a ficha desse frasco.
 *   `produto` .. um código já conhecido, mas de um frasco que não é este. Abre
 *                uma entrada nova, já preenchida.
 *   `novo` ..... nunca visto. Abre uma entrada nova com o código agarrado.
 */
export type DestinoDoCodigo =
  | { tipo: 'lote'; medicamento: Medicamento; codigo: CodigoLido }
  | { tipo: 'produto'; produto: ProdutoConhecido; codigo: CodigoLido }
  | { tipo: 'novo'; codigo: CodigoLido };

export function destinoDoCodigo(
  bruto: string,
  medicamentos: Medicamento[],
  exploracaoId?: string,
  anoAtual?: number,
): DestinoDoCodigo {
  const codigo = analisarCodigo(bruto, anoAtual);

  if (codigo.loteId) {
    const m = medicamentos.find((x) => x.id === codigo.loteId);
    if (m) return { tipo: 'lote', medicamento: m, codigo };
    // Etiqueta de um lote que já não existe (eliminado, ou de outra conta).
    // Cai para o caminho normal em vez de dar erro: o código guarda-se na mesma.
    return { tipo: 'novo', codigo };
  }

  // Com lote lido do símbolo, procura-se o FRASCO e não só o produto: é a
  // diferença entre "abre a Penicilina" e "abre este frasco de Penicilina",
  // e é essa a pergunta de quem tem o frasco na mão.
  if (codigo.lote) {
    const alvo = codigo.lote.trim().toUpperCase();
    const mesmoFrasco = medicamentos.find(
      (m) => m.codigoBarras === codigo.chave && m.lote?.trim().toUpperCase() === alvo,
    );
    if (mesmoFrasco) return { tipo: 'lote', medicamento: mesmoFrasco, codigo };
  }

  const produto = produtoConhecido(codigo.chave, medicamentos, exploracaoId);
  return produto ? { tipo: 'produto', produto, codigo } : { tipo: 'novo', codigo };
}
