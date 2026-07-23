/**
 * Geração e leitura do ficheiro Excel.
 * ------------------------------------------------------------------
 * Só web/Electron: usa o DOM (Blob + <input type="file">) para escrever e ler
 * ficheiros. No telemóvel, escolher um ficheiro precisa de um módulo nativo
 * (expo-document-picker) e de um build novo.
 *
 * Duas bibliotecas, de propósito:
 *   - ESCRITA (`xlsx-js-style`) — o SheetJS gratuito não escreve estilos; este
 *     fork escreve (cores, negrito), e é o que dá cabeçalhos coloridos ao modelo
 *     e à exportação.
 *   - LEITURA (`xlsx`, build 0.20.3 do CDN) — mantém-se a versão sem o advisory
 *     de segurança, que é a que interessa ao abrir ficheiros que podem vir de
 *     fora.
 * A validação vive em `animalExcel.ts`, testável e sem estas dependências.
 *
 * As listas pendentes (dropdowns) do Excel são cosidas à mão no XML da folha —
 * ver `comValidacoes`. Nenhum dos dois SheetJS as sabe escrever, e sem elas o
 * criador escrevia "AAAA" na espécie e só descobria o erro no fim da
 * importação, quando já tinha a folha toda preenchida.
 */

import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';

import {
  COLUNAS,
  EXEMPLOS,
  interpretarMatriz,
  type CampoImportado,
  type ResultadoImportacao,
} from './animalExcel';
import { hojeISO } from './exportar';
import { formatDataCurta } from './helpers';
import type { Animal } from './types';

const NOME_FOLHA = 'Animais';
/** Folha onde vivem os valores das listas pendentes (as dropdowns apontam-lhe). */
const NOME_FOLHA_LISTAS = 'Listas';

/**
 * Até que linha da folha "Animais" as listas pendentes chegam. O Excel não tem
 * "a coluna toda" sem custo — cada validação guarda o intervalo — por isso vai
 * folgado até onde ninguém escreve à mão, e a exportação estica-o se trouxer
 * mais animais do que isto.
 */
const LINHAS_COM_LISTA = 1000;

/** Colunas que oferecem lista pendente, pela ordem em que entram na folha "Listas". */
const COLUNAS_COM_LISTA = COLUNAS.filter((c) => c.opcoes);

/** true num ambiente com DOM (web/Electron) — onde descarregar/ler funciona. */
export const importacaoDisponivel =
  typeof document !== 'undefined' && typeof window !== 'undefined';

/* ------------------------------------------------------------------ *
 *  Estilos (só afetam a escrita; `xlsx-js-style` lê a propriedade `s`)
 * ------------------------------------------------------------------ */

const COR = {
  verde: '1B7A48', // marca — cabeçalhos obrigatórios
  cinza: 'E3EAE0', // cabeçalhos opcionais
  texto: '15251C',
  branco: 'FFFFFF',
} as const;

type EstiloCelula = {
  font?: { bold?: boolean; sz?: number; color?: { rgb: string } };
  fill?: { patternType: string; fgColor: { rgb: string } };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'center' | 'bottom';
    wrapText?: boolean;
  };
};

/** Célula de uma worksheet, com a propriedade de estilo do xlsx-js-style. */
type CelulaComEstilo = { s?: EstiloCelula };

/** Cabeçalho: verde com texto branco se obrigatório; cinza claro se opcional. */
function estiloCabecalho(obrigatorio: boolean): EstiloCelula {
  return {
    font: { bold: true, sz: 11, color: { rgb: obrigatorio ? COR.branco : COR.texto } },
    fill: { patternType: 'solid', fgColor: { rgb: obrigatorio ? COR.verde : COR.cinza } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };
}

/** Aplica um estilo a uma célula pela sua posição (linha/coluna, base 0). */
function estilizar(ws: XLSX.WorkSheet, r: number, c: number, s: EstiloCelula): void {
  const ref = XLSXStyle.utils.encode_cell({ r, c });
  const cel = ws[ref] as CelulaComEstilo | undefined;
  if (cel) cel.s = s;
}

/* ------------------------------------------------------------------ *
 *  Animal → linha (mesma ordem das colunas do modelo de importação)
 * ------------------------------------------------------------------ */

function valorDaColuna(a: Animal, campo: CampoImportado): string {
  switch (campo) {
    case 'nome':
      return a.nome ?? '';
    case 'especie':
      return a.especie;
    case 'sexo':
      return a.sexo;
    case 'dataNascimento':
      return a.dataNascimento ? formatDataCurta(a.dataNascimento) : '';
    case 'raca':
      return a.raca ?? '';
    case 'corPelagem':
      return a.corPelagem ?? '';
    case 'numeroIdentificacao':
      return a.numeroIdentificacao ?? '';
    case 'dataIdentificacao':
      return a.dataIdentificacao ? formatDataCurta(a.dataIdentificacao) : '';
    case 'finalidade':
      return a.finalidade ?? '';
    case 'casa':
      return a.casa ?? '';
    case 'numeroCasa':
      return a.numeroCasa ?? '';
    case 'comunicadoSnira':
      return a.comunicadoSnira == null ? '' : a.comunicadoSnira ? 'Sim' : 'Não';
    case 'dataPrevistaParto':
      return a.dataPrevistaParto ? formatDataCurta(a.dataPrevistaParto) : '';
  }
}

/* ------------------------------------------------------------------ *
 *  Construção do workbook (modelo vazio ou já com animais)
 * ------------------------------------------------------------------ */

/**
 * Um workbook com a folha "Animais" (cabeçalhos coloridos + as linhas dos
 * animais dados) e a folha "Instruções". Com `animais` vazio é o modelo em
 * branco; com animais é a exportação — e as duas têm exatamente as mesmas
 * colunas, para o que se exporta poder voltar a ser importado.
 */
function construirWorkbook(animais: Animal[]): XLSX.WorkBook {
  const wb = XLSXStyle.utils.book_new();
  const cabecalhos = COLUNAS.map((c) => c.rotulo);
  const linhas = animais.map((a) => COLUNAS.map((c) => valorDaColuna(a, c.campo)));

  const ws = XLSXStyle.utils.aoa_to_sheet([cabecalhos, ...linhas]);
  ws['!cols'] = COLUNAS.map((c) => ({ wch: Math.max(14, c.rotulo.length + 2) }));
  ws['!rows'] = [{ hpt: 22 }];
  COLUNAS.forEach((c, i) => estilizar(ws, 0, i, estiloCabecalho(c.obrigatorio)));
  XLSXStyle.utils.book_append_sheet(wb, ws, NOME_FOLHA);

  // Folha de instruções.
  const CABECALHO_TABELA = ['Coluna', 'Obrigatória?', 'O que escrever'];
  const linhasInstr: string[][] = [
    ['Como preencher'],
    ['Escreva um animal por linha na folha "Animais". As datas em dd/mm/aaaa.'],
    ['As colunas a verde são obrigatórias.'],
    [
      'Clique numa célula: as colunas com lista mostram uma seta à direita — escolha o valor em vez de o escrever.',
    ],
    ['Todos os valores aceites estão na folha "Listas".'],
    [''],
    CABECALHO_TABELA,
    ...COLUNAS.map((c) => [c.rotulo, c.obrigatorio ? 'Sim' : 'Não', c.ajuda]),
    [''],
    ['Exemplos:'],
    cabecalhos,
    ...EXEMPLOS.map((ex) => COLUNAS.map((c) => ex[c.campo] ?? '')),
  ];
  const wsInstr = XLSXStyle.utils.aoa_to_sheet(linhasInstr);
  wsInstr['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 72 }];
  estilizar(wsInstr, 0, 0, { font: { bold: true, sz: 14, color: { rgb: COR.texto } } });
  // Linha de cabeçalho da tabela de colunas — onde quer que ela tenha calhado.
  const linhaTabela = linhasInstr.indexOf(CABECALHO_TABELA);
  CABECALHO_TABELA.forEach((_, i) => estilizar(wsInstr, linhaTabela, i, estiloCabecalho(true)));
  XLSXStyle.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  // Folha "Listas": uma coluna por cada campo com lista pendente. É a fonte
  // das dropdowns — fica à vista (e não escondida) porque é também onde o
  // criador vai ver, sem sair do Excel, o que a app aceita.
  const maxValores = Math.max(...COLUNAS_COM_LISTA.map((c) => c.opcoes!.valores.length));
  const linhasListas: string[][] = [COLUNAS_COM_LISTA.map((c) => c.rotulo)];
  for (let i = 0; i < maxValores; i++) {
    linhasListas.push(COLUNAS_COM_LISTA.map((c) => c.opcoes!.valores[i] ?? ''));
  }
  const wsListas = XLSXStyle.utils.aoa_to_sheet(linhasListas);
  wsListas['!cols'] = COLUNAS_COM_LISTA.map((c) => ({ wch: Math.max(16, c.rotulo.length + 2) }));
  COLUNAS_COM_LISTA.forEach((_, i) => estilizar(wsListas, 0, i, estiloCabecalho(true)));
  XLSXStyle.utils.book_append_sheet(wb, wsListas, NOME_FOLHA_LISTAS);

  return wb;
}

/* ------------------------------------------------------------------ *
 *  Listas pendentes (dataValidation) — escritas à mão no XML
 * ------------------------------------------------------------------ */

/** Texto seguro dentro de um atributo XML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** O Excel corta os títulos aos 32 caracteres e as mensagens aos 255. */
function cortar(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * O bloco `<dataValidations>` da folha "Animais": uma entrada por coluna, da
 * linha 2 até `ultimaLinha`.
 *
 * Todas as colunas ganham a mensagem de ajuda que aparece ao clicar na célula
 * (é a mesma da folha "Instruções", agora onde ela faz falta). As que têm
 * valores conhecidos ganham além disso a lista pendente, a apontar para a
 * coluna respetiva da folha "Listas".
 */
function xmlValidacoes(ultimaLinha: number): string {
  const blocos = COLUNAS.map((c, i) => {
    const col = XLSXStyle.utils.encode_col(i);
    const sqref = `${col}2:${col}${ultimaLinha}`;
    const prompt =
      ` promptTitle="${esc(cortar(c.rotulo, 32))}" prompt="${esc(cortar(c.ajuda, 255))}"` +
      ' showInputMessage="1"';

    if (!c.opcoes) {
      return `<dataValidation type="none" allowBlank="1"${prompt} sqref="${sqref}"/>`;
    }

    const { valores, estrita } = c.opcoes;
    const colLista = XLSXStyle.utils.encode_col(COLUNAS_COM_LISTA.indexOf(c));
    const intervalo = `${NOME_FOLHA_LISTAS}!$${colLista}$2:$${colLista}$${valores.length + 1}`;
    // Só as listas estritas recusam o que não conhecem; nas outras a dropdown
    // sugere e o criador pode escrever outra coisa (ver `OpcoesColuna`).
    const erro = estrita
      ? ' showErrorMessage="1" errorStyle="stop" errorTitle="Valor não aceite"' +
        ` error="${esc(cortar(`A app não conhece este valor. Escolha da lista: ${valores.join(', ')}.`, 255))}"`
      : ' showErrorMessage="0"';
    return (
      `<dataValidation type="list" allowBlank="1"${prompt}${erro} sqref="${sqref}">` +
      `<formula1>${esc(intervalo)}</formula1></dataValidation>`
    );
  });
  return `<dataValidations count="${blocos.length}">${blocos.join('')}</dataValidations>`;
}

/** O modelo em branco (usado no teste de round-trip e no download). */
export function construirTemplate(): XLSX.WorkBook {
  return construirWorkbook([]);
}

/* ------------------------------------------------------------------ *
 *  Escrita dos bytes (write + costura das listas pendentes)
 * ------------------------------------------------------------------ */

/**
 * Bytes, venha o resultado do SheetJS como for (Buffer, ArrayBuffer, array) —
 * o `type: 'array'` devolve coisas diferentes conforme o ambiente. O `as` é
 * sobre a origem do buffer, que o TS distingue mas aqui é sempre um `ArrayBuffer`.
 */
function bytes(v: unknown): Uint8Array<ArrayBuffer> {
  if (v instanceof Uint8Array) return v as Uint8Array<ArrayBuffer>;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return new Uint8Array(v as number[]);
}

/**
 * Enfia o bloco de listas pendentes na folha "Animais" do `.xlsx` já escrito.
 *
 * Um `.xlsx` é um zip de XML, e o `CFB` que vem com o SheetJS abre-o e volta a
 * fechá-lo — é por aí que se acrescenta o que a biblioteca não escreve. O bloco
 * tem de ficar ANTES de `<ignoredErrors>`: o Excel valida a ordem dos elementos
 * da folha e, trocada, pede para reparar o ficheiro ao abri-lo.
 */
function comValidacoes(
  ficheiro: Uint8Array<ArrayBuffer>,
  indiceFolha: number,
  ultimaLinha: number,
): Uint8Array<ArrayBuffer> {
  const caminho = `/xl/worksheets/sheet${indiceFolha + 1}.xml`;
  const zip = XLSX.CFB.read(ficheiro, { type: 'array' });
  const entrada = XLSX.CFB.find(zip, caminho);
  if (!entrada) return ficheiro; // sem a folha esperada, entrega-se o original

  const xml = new TextDecoder().decode(bytes(entrada.content));
  const corte = xml.indexOf('<ignoredErrors');
  const pos = corte >= 0 ? corte : xml.lastIndexOf('</worksheet>');
  if (pos < 0) return ficheiro;

  const novo = xml.slice(0, pos) + xmlValidacoes(ultimaLinha) + xml.slice(pos);
  XLSX.CFB.utils.cfb_add(zip, caminho, new TextEncoder().encode(novo));
  return bytes(XLSX.CFB.write(zip, { fileType: 'zip', type: 'array', compression: true }));
}

/**
 * O `.xlsx` em bytes: o que o SheetJS escreve (com estilos) mais as listas
 * pendentes. É por aqui que passam o download e o teste de round-trip.
 */
export function escreverWorkbook(wb: XLSX.WorkBook, linhasDados = 0): Uint8Array<ArrayBuffer> {
  // `XLSXStyle.write` é o que preserva os estilos das células.
  const escrito = bytes(XLSXStyle.write(wb, { type: 'array', bookType: 'xlsx' }));
  const indice = wb.SheetNames.indexOf(NOME_FOLHA);
  if (indice < 0) return escrito;
  return comValidacoes(escrito, indice, Math.max(LINHAS_COM_LISTA, linhasDados + 1));
}

/* ------------------------------------------------------------------ *
 *  Descarregar (web/Electron)
 * ------------------------------------------------------------------ */

function descarregarWorkbook(wb: XLSX.WorkBook, nomeFicheiro: string, linhasDados = 0): void {
  if (!importacaoDisponivel) return;
  const out = escreverWorkbook(wb, linhasDados);
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Gera o modelo em branco e descarrega-o. */
export function descarregarTemplate(): void {
  descarregarWorkbook(construirTemplate(), `modelo-animais-${hojeISO()}.xlsx`);
}

/**
 * Exporta os animais dados num `.xlsx` com as mesmas colunas do modelo de
 * importação — para se exportar, editar/acrescentar no Excel e reimportar.
 */
export function exportarAnimaisExcel(animais: Animal[]): void {
  descarregarWorkbook(construirWorkbook(animais), `animais-${hojeISO()}.xlsx`, animais.length);
}

/* ------------------------------------------------------------------ *
 *  Ler (xlsx 0.20.3 — leitura segura)
 * ------------------------------------------------------------------ */

function resultadoVazio(): ResultadoImportacao {
  return {
    linhas: [],
    validas: 0,
    comErro: 0,
    duplicadas: 0,
    colunasEmFalta: COLUNAS.filter((c) => c.obrigatorio).map((c) => c.rotulo),
    colunasIgnoradas: [],
  };
}

/**
 * Lê um ficheiro já escolhido e interpreta-o. `brincosExistentes` são os brincos
 * dos animais que já estão na conta, para a validação saltar os repetidos.
 */
export async function lerFicheiroExcel(
  file: File,
  brincosExistentes: string[] = [],
): Promise<ResultadoImportacao> {
  const buf = await file.arrayBuffer();
  // `cellDates` faz as datas do Excel virem como `Date` em vez de número de
  // série — é o que a validação sabe converter sem depender do fuso horário.
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
  const nome =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === NOME_FOLHA.toLowerCase()) ??
    wb.SheetNames[0];
  const ws = nome ? wb.Sheets[nome] : undefined;
  if (!ws) return resultadoVazio();
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: '',
  });
  return interpretarMatriz(matriz, brincosExistentes);
}

/**
 * Abre o seletor de ficheiros e devolve o resultado da leitura, ou `null` se o
 * criador cancelar. Só web/Electron.
 */
export function escolherELerExcel(
  brincosExistentes: string[] = [],
): Promise<ResultadoImportacao | null> {
  return new Promise((resolve, reject) => {
    if (!importacaoDisponivel) {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.style.display = 'none';

    const limpar = () => {
      if (input.parentNode) document.body.removeChild(input);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      limpar();
      if (!file) {
        resolve(null);
        return;
      }
      lerFicheiroExcel(file, brincosExistentes).then(resolve, reject);
    };
    input.oncancel = () => {
      limpar();
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}
