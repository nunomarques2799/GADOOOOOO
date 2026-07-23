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
  const linhasInstr: string[][] = [
    ['Como preencher'],
    ['Escreva um animal por linha na folha "Animais". As datas em dd/mm/aaaa.'],
    ['As colunas a verde são obrigatórias.'],
    [''],
    ['Coluna', 'Obrigatória?', 'O que escrever'],
    ...COLUNAS.map((c) => [c.rotulo, c.obrigatorio ? 'Sim' : 'Não', c.ajuda]),
    [''],
    ['Exemplos:'],
    cabecalhos,
    ...EXEMPLOS.map((ex) => COLUNAS.map((c) => ex[c.campo] ?? '')),
  ];
  const wsInstr = XLSXStyle.utils.aoa_to_sheet(linhasInstr);
  wsInstr['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 72 }];
  estilizar(wsInstr, 0, 0, { font: { bold: true, sz: 14, color: { rgb: COR.texto } } });
  // Linha de cabeçalho da tabela de colunas (índice 4).
  ['Coluna', 'Obrigatória?', 'O que escrever'].forEach((_, i) =>
    estilizar(wsInstr, 4, i, estiloCabecalho(true)),
  );
  XLSXStyle.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  return wb;
}

/** O modelo em branco (usado no teste de round-trip e no download). */
export function construirTemplate(): XLSX.WorkBook {
  return construirWorkbook([]);
}

/* ------------------------------------------------------------------ *
 *  Descarregar (web/Electron)
 * ------------------------------------------------------------------ */

function descarregarWorkbook(wb: XLSX.WorkBook, nomeFicheiro: string): void {
  if (!importacaoDisponivel) return;
  // `XLSXStyle.write` é o que preserva os estilos das células.
  const out = XLSXStyle.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
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
  descarregarWorkbook(construirWorkbook(animais), `animais-${hojeISO()}.xlsx`);
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
