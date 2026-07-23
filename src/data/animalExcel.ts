/**
 * Importação de animais a partir de Excel — a parte pura (sem xlsx, sem React).
 * ------------------------------------------------------------------
 * Aqui vive o que decide o formato do template e o que transforma cada linha
 * lida numa ficha de animal válida. A leitura do `.xlsx` em si (SheetJS) e o
 * descarregar/escolher ficheiros ficam em `animalExcelFicheiro.ts`, que é só
 * web/Electron — esta parte é lógica testável e corre em qualquer lado.
 *
 * As colunas espelham o que o formulário de "Novo animal" pede. Só se importam
 * campos simples: terreno, mãe e pai são relações que se escolhem na app (por
 * id, entre os animais que já existem) e não cabem numa folha escrita à mão.
 *
 * A validação segue a MESMA régua do formulário (`FormularioAnimal.tsx`): as
 * datas passam pelo `parseDataPt` (recusa datas futuras, exceto o parto), e a
 * espécie/sexo/finalidade são conferidas contra os enums de `constants.ts`.
 * Uma linha inválida não trava as outras — é reportada e o resto importa.
 */

import { especies, finalidades, finalidadesPara, sexos } from './constants';
import { parseDataPt } from './helpers';
import { normalizar } from './racas';
import type { Animal, Especie, Finalidade, Sexo } from './types';

/** Campo do animal que uma coluna do template preenche. */
export type CampoImportado =
  | 'nome'
  | 'especie'
  | 'sexo'
  | 'dataNascimento'
  | 'raca'
  | 'corPelagem'
  | 'numeroIdentificacao'
  | 'dataIdentificacao'
  | 'finalidade'
  | 'casa'
  | 'numeroCasa'
  | 'comunicadoSnira'
  | 'dataPrevistaParto';

/** Dados de um animal lidos de uma linha — sem id nem exploração (a exploração
 *  escolhe-se na app, o id gera-se ao gravar). */
export type DadosAnimalImportado = Omit<Animal, 'id' | 'exploracaoId' | 'atualizadoEm'>;

/** Definição de uma coluna do template. */
export type ColunaTemplate = {
  campo: CampoImportado;
  rotulo: string;
  obrigatorio: boolean;
  exemplo: string;
  ajuda: string;
  /** Outras formas de escrever o cabeçalho, além do rótulo (comparadas sem
   *  acentos, maiúsculas nem pontuação). */
  aliases?: string[];
};

/**
 * As colunas do template, por esta ordem. Só `especie`, `sexo` e
 * `dataNascimento` são obrigatórias — são as únicas que o animal não pode
 * dispensar (a app calcula idade e alertas a partir delas).
 */
export const COLUNAS: ColunaTemplate[] = [
  {
    campo: 'nome',
    rotulo: 'Nome',
    obrigatorio: false,
    exemplo: 'Mimosa',
    ajuda: 'Nome ou alcunha do animal.',
  },
  {
    campo: 'especie',
    rotulo: 'Espécie',
    obrigatorio: true,
    exemplo: 'Bovino',
    ajuda: `Obrigatório. Um de: ${especies.join(', ')}.`,
    aliases: ['especies'],
  },
  {
    campo: 'sexo',
    rotulo: 'Sexo',
    obrigatorio: true,
    exemplo: 'Fêmea',
    ajuda: 'Obrigatório. Macho ou Fêmea (também aceita M ou F).',
  },
  {
    campo: 'dataNascimento',
    rotulo: 'Data de nascimento',
    obrigatorio: true,
    exemplo: '15/03/2021',
    ajuda: 'Obrigatório. Formato dd/mm/aaaa. Não pode ser uma data futura.',
    aliases: ['nascimento', 'data nasc', 'data de nasc'],
  },
  {
    campo: 'raca',
    rotulo: 'Raça',
    obrigatorio: false,
    exemplo: 'Mertolenga',
    ajuda: 'Escrita por extenso. Se não estiver na lista da app, entra na mesma.',
  },
  {
    campo: 'corPelagem',
    rotulo: 'Cor da pelagem',
    obrigatorio: false,
    exemplo: 'Malhada',
    ajuda: 'Cor ou pelagem do animal.',
    aliases: ['cor', 'pelagem'],
  },
  {
    campo: 'numeroIdentificacao',
    rotulo: 'Nº de brinco (SIA)',
    obrigatorio: false,
    exemplo: 'PT 6120 0011 2201',
    ajuda: 'Número do brinco oficial. Deixe vazio se ainda não tem — a app cria o alerta de identificação.',
    aliases: ['brinco', 'sia', 'numero de identificacao', 'n brinco'],
  },
  {
    campo: 'dataIdentificacao',
    rotulo: 'Data de identificação',
    obrigatorio: false,
    exemplo: '30/03/2021',
    ajuda: 'Data em que o brinco foi colocado (dd/mm/aaaa). Só conta se houver brinco.',
    aliases: ['data do brinco'],
  },
  {
    campo: 'finalidade',
    rotulo: 'Finalidade',
    obrigatorio: false,
    exemplo: 'Leite',
    ajuda: `Só para bovinos. Um de: ${finalidades.join(', ')}.`,
  },
  {
    campo: 'casa',
    rotulo: 'Casa',
    obrigatorio: false,
    exemplo: 'Casa do Alto',
    ajuda: 'Registo tradicional por casa.',
  },
  {
    campo: 'numeroCasa',
    rotulo: 'Nº na casa',
    obrigatorio: false,
    exemplo: '3',
    ajuda: 'Número do animal dentro da casa.',
    aliases: ['numero da casa', 'n casa', 'numero na casa'],
  },
  {
    campo: 'comunicadoSnira',
    rotulo: 'Comunicado ao SNIRA',
    obrigatorio: false,
    exemplo: 'Sim',
    ajuda: 'Sim ou Não. Só conta se houver brinco. Em branco assume-se Sim.',
    aliases: ['snira'],
  },
  {
    campo: 'dataPrevistaParto',
    rotulo: 'Data prevista de parto',
    obrigatorio: false,
    exemplo: '',
    ajuda: 'Só para fêmeas prenhes (dd/mm/aaaa). Pode ser uma data futura.',
    aliases: ['parto', 'data de parto', 'data prevista parto'],
  },
];

/** Linhas de exemplo, para a folha de instruções do template. */
export const EXEMPLOS: Record<CampoImportado, string>[] = [
  {
    nome: 'Mimosa',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: '15/03/2021',
    raca: 'Mertolenga',
    corPelagem: 'Malhada',
    numeroIdentificacao: 'PT 6120 0011 2201',
    dataIdentificacao: '30/03/2021',
    finalidade: 'Leite',
    casa: 'Casa do Alto',
    numeroCasa: '3',
    comunicadoSnira: 'Sim',
    dataPrevistaParto: '',
  },
  {
    nome: 'Trovão',
    especie: 'Bovino',
    sexo: 'Macho',
    dataNascimento: '02/05/2022',
    raca: 'Charolesa',
    corPelagem: 'Branca',
    numeroIdentificacao: 'PT 6120 0011 2207',
    dataIdentificacao: '20/05/2022',
    finalidade: 'Carne',
    casa: 'Casa do Souto',
    numeroCasa: '2',
    comunicadoSnira: 'Sim',
    dataPrevistaParto: '',
  },
];

/** O que a leitura de uma linha produziu. `dados` só existe se a linha for
 *  importável — sem erros de validação E sem ser um duplicado. */
export type LinhaImportacao = {
  /** Número da linha no Excel (o cabeçalho é a linha 1, os dados começam na 2). */
  numero: number;
  dados?: DadosAnimalImportado;
  /** Problemas que impedem esta linha de ser importada. */
  erros: string[];
  /** Coisas que não impedem a importação, mas convém o criador saber. */
  avisos: string[];
  /**
   * Brinco repetido: `ja-existe` = já há um animal com este brinco na conta;
   * `no-ficheiro` = aparece mais do que uma vez no próprio ficheiro. Em ambos
   * os casos a linha NÃO é importada (não há `dados`) — evita criar o mesmo
   * animal duas vezes, que é o que acontece quem exporta, edita e reimporta.
   */
  duplicado?: 'no-ficheiro' | 'ja-existe';
  /** Como referir esta linha na lista (nome, brinco, ou "Linha N"). */
  rotulo: string;
};

export type ResultadoImportacao = {
  linhas: LinhaImportacao[];
  /** Linhas que vão ser importadas. */
  validas: number;
  /** Linhas com erro de validação. */
  comErro: number;
  /** Linhas saltadas por brinco repetido (já existe ou repetido no ficheiro). */
  duplicadas: number;
  /** Rótulos de colunas obrigatórias que o ficheiro não trazia. */
  colunasEmFalta: string[];
  /** Cabeçalhos do ficheiro que não correspondem a nenhuma coluna conhecida. */
  colunasIgnoradas: string[];
};

/* ------------------------------------------------------------------ *
 *  Conversão de células
 * ------------------------------------------------------------------ */

/** Texto limpo de uma célula (número ou string). Vazio para nulos. */
function texto(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Uma data em texto dd/mm/aaaa, venha de onde vier. O SheetJS lê as datas do
 * Excel como `Date` (ficheiro aberto com `cellDates`), e o criador pode ter
 * escrito à mão como texto — os dois casos convergem aqui para depois passarem
 * pelo mesmo `parseDataPt` que o formulário usa.
 */
function textoData(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(v.getDate())}/${p(v.getMonth() + 1)}/${v.getFullYear()}`;
  }
  return texto(v);
}

/** Chave de comparação: sem acentos, minúsculas e sem pontuação/espaços. */
function chaveCol(s: string): string {
  return normalizar(s).replace(/[^a-z0-9]/g, '');
}

const CHAVE_PARA_CAMPO = new Map<string, CampoImportado>();
for (const c of COLUNAS) {
  CHAVE_PARA_CAMPO.set(chaveCol(c.rotulo), c.campo);
  for (const a of c.aliases ?? []) CHAVE_PARA_CAMPO.set(chaveCol(a), c.campo);
}

/**
 * Chave para comparar brincos: sem acentos, maiúsculas nem espaços, para que
 * "PT 6120 0011 2201" e "pt612000112201" contem como o mesmo animal (é o mesmo
 * número, escrito com espaçamento diferente).
 */
export function chaveBrinco(s: string | undefined): string {
  return normalizar(s ?? '').replace(/\s+/g, '');
}

function parseEspecie(v: unknown): Especie | null {
  const k = chaveCol(texto(v));
  return especies.find((e) => chaveCol(e) === k) ?? null;
}

function parseSexo(v: unknown): Sexo | null {
  const k = chaveCol(texto(v));
  if (k === 'm' || k === 'macho') return 'Macho';
  if (k === 'f' || k === 'femea') return 'Fêmea';
  return sexos.find((s) => chaveCol(s) === k) ?? null;
}

function parseFinalidade(v: unknown): Finalidade | null {
  const k = chaveCol(texto(v));
  if (!k) return null;
  return finalidades.find((f) => chaveCol(f) === k) ?? null;
}

/** Sim/Não tolerante. `null` = não reconhecido; célula vazia devolve `null`. */
function parseBooleano(v: unknown): boolean | null {
  const k = chaveCol(texto(v));
  if (!k) return null;
  if (['sim', 's', 'true', 'verdadeiro', 'x', '1'].includes(k)) return true;
  if (['nao', 'n', 'false', 'falso', '0'].includes(k)) return false;
  return null;
}

/* ------------------------------------------------------------------ *
 *  Linha → animal
 * ------------------------------------------------------------------ */

/**
 * Interpreta uma linha (valores já indexados por campo) e devolve o animal
 * pronto ou a lista de erros. `numero` é a linha no Excel, para o criador a
 * encontrar.
 */
export function linhaParaAnimal(
  valores: Partial<Record<CampoImportado, unknown>>,
  numero: number,
): LinhaImportacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  const nome = texto(valores.nome);
  const brinco = texto(valores.numeroIdentificacao);
  const raca = texto(valores.raca);
  const cor = texto(valores.corPelagem);
  const casa = texto(valores.casa);
  const numeroCasa = texto(valores.numeroCasa);

  // ---- Espécie (obrigatória) ----
  const txtEspecie = texto(valores.especie);
  const especie = parseEspecie(valores.especie);
  if (!txtEspecie) erros.push('Falta a espécie.');
  else if (!especie)
    erros.push(`Espécie "${txtEspecie}" não é válida. Use: ${especies.join(', ')}.`);

  // ---- Sexo (obrigatório) ----
  const txtSexo = texto(valores.sexo);
  const sexo = parseSexo(valores.sexo);
  if (!txtSexo) erros.push('Falta o sexo.');
  else if (!sexo) erros.push(`Sexo "${txtSexo}" não é válido. Use Macho ou Fêmea.`);

  // ---- Data de nascimento (obrigatória) ----
  const txtNasc = textoData(valores.dataNascimento);
  const dataNascimento = txtNasc ? parseDataPt(txtNasc) : null;
  if (!txtNasc) erros.push('Falta a data de nascimento.');
  else if (!dataNascimento)
    erros.push(`Data de nascimento "${txtNasc}" inválida. Use dd/mm/aaaa e uma data não futura.`);

  // ---- Finalidade (opcional, só bovinos) ----
  let finalidade: Finalidade | undefined;
  const txtFin = texto(valores.finalidade);
  if (txtFin) {
    const f = parseFinalidade(valores.finalidade);
    if (!f) avisos.push(`Finalidade "${txtFin}" não reconhecida — ignorada.`);
    else if (especie && especie !== 'Bovino')
      avisos.push('Finalidade só se aplica a bovinos — ignorada.');
    else {
      finalidade = f;
      if (sexo && !finalidadesPara(sexo).includes(f))
        avisos.push(`Finalidade "${f}" não é típica de ${sexo.toLowerCase()} — foi guardada na mesma.`);
    }
  }

  // ---- Data de identificação (opcional) ----
  let dataIdentificacao: string | undefined;
  const txtIdent = textoData(valores.dataIdentificacao);
  if (txtIdent) {
    const di = parseDataPt(txtIdent);
    if (!di) avisos.push(`Data de identificação "${txtIdent}" inválida — ignorada.`);
    else dataIdentificacao = di;
  }

  // ---- Comunicado ao SNIRA (opcional) ----
  let sniraValor: boolean | null = null;
  const txtSnira = texto(valores.comunicadoSnira);
  if (txtSnira) {
    sniraValor = parseBooleano(valores.comunicadoSnira);
    if (sniraValor === null) avisos.push(`"${txtSnira}" não é Sim nem Não — assumido Sim.`);
  }

  // ---- Data prevista de parto (opcional, pode ser futura) ----
  let dataPrevistaParto: string | undefined;
  const txtParto = textoData(valores.dataPrevistaParto);
  if (txtParto) {
    const dp = parseDataPt(txtParto, { permitirFuturo: true });
    if (!dp) avisos.push(`Data prevista de parto "${txtParto}" inválida — ignorada.`);
    else if (sexo === 'Macho') avisos.push('Data de parto indicada num macho — ignorada.');
    else dataPrevistaParto = dp;
  }

  const rotulo = nome || brinco || `Linha ${numero}`;

  if (erros.length > 0 || !especie || !sexo || !dataNascimento) {
    return { numero, erros, avisos, rotulo };
  }

  const temBrinco = brinco.length > 0;
  const dados: DadosAnimalImportado = {
    especie,
    sexo,
    dataNascimento,
    nome: nome || undefined,
    numeroIdentificacao: temBrinco ? brinco : undefined,
    raca: raca || undefined,
    corPelagem: cor || undefined,
    finalidade: especie === 'Bovino' ? finalidade : undefined,
    casa: casa || undefined,
    numeroCasa: numeroCasa || undefined,
    // Espelha o formulário: com brinco, assume-se já comunicado a menos que a
    // coluna diga o contrário — importar um efetivo que já existe não deve
    // encher a app de alertas de "comunicar ao SNIRA". Sem brinco, fica por
    // identificar (e a app gera o alerta, tal como no registo manual).
    comunicadoSnira: temBrinco ? (sniraValor ?? true) : undefined,
    dataIdentificacao: temBrinco ? (dataIdentificacao ?? dataNascimento) : undefined,
    dataPrevistaParto: sexo === 'Fêmea' ? dataPrevistaParto : undefined,
  };
  return { numero, dados, erros, avisos, rotulo };
}

/**
 * Interpreta a folha inteira, recebida como matriz de células (a 1.ª linha são
 * os cabeçalhos). Reconhece as colunas pelos cabeçalhos, salta linhas vazias e
 * converte cada linha de dados. Não conhece o SheetJS — quem o chama entrega já
 * a matriz.
 */
export function interpretarMatriz(
  matriz: unknown[][],
  brincosExistentes: Iterable<string> = [],
): ResultadoImportacao {
  const linhas: LinhaImportacao[] = [];
  const colunasIgnoradas: string[] = [];

  const cabecalho = matriz[0] ?? [];
  const idxCampo: (CampoImportado | null)[] = cabecalho.map((h) => {
    const t = texto(h);
    if (!t) return null;
    const campo = CHAVE_PARA_CAMPO.get(chaveCol(t)) ?? null;
    if (!campo) colunasIgnoradas.push(t);
    return campo;
  });

  const presentes = new Set(idxCampo.filter((c): c is CampoImportado => c != null));
  const colunasEmFalta = COLUNAS.filter((c) => c.obrigatorio && !presentes.has(c.campo)).map(
    (c) => c.rotulo,
  );

  for (let r = 1; r < matriz.length; r++) {
    const linha = matriz[r] ?? [];
    if (linha.every((v) => texto(v) === '')) continue; // linha em branco → ignora
    const valores: Partial<Record<CampoImportado, unknown>> = {};
    idxCampo.forEach((campo, i) => {
      if (campo) valores[campo] = linha[i];
    });
    linhas.push(linhaParaAnimal(valores, r + 1));
  }

  // Segunda passagem: brincos repetidos. Só as linhas que passaram na validação
  // e têm brinco entram nesta conta — sem brinco não há como saber se é o mesmo
  // animal, por isso essas passam sempre.
  const jaNaConta = new Set<string>();
  for (const b of brincosExistentes) {
    const k = chaveBrinco(b);
    if (k) jaNaConta.add(k);
  }
  const vistosNoFicheiro = new Set<string>();
  for (const l of linhas) {
    const brinco = l.dados?.numeroIdentificacao;
    if (!brinco) continue;
    const k = chaveBrinco(brinco);
    if (jaNaConta.has(k)) {
      l.duplicado = 'ja-existe';
      l.dados = undefined;
    } else if (vistosNoFicheiro.has(k)) {
      l.duplicado = 'no-ficheiro';
      l.dados = undefined;
    } else {
      vistosNoFicheiro.add(k);
    }
  }

  const validas = linhas.filter((l) => l.dados).length;
  const duplicadas = linhas.filter((l) => l.duplicado).length;
  return {
    linhas,
    validas,
    comErro: linhas.length - validas - duplicadas,
    duplicadas,
    colunasEmFalta,
    colunasIgnoradas,
  };
}
