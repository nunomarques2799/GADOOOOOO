/**
 * Ficheiros Excel — a parte comum a todas as folhas que a app escreve.
 * ------------------------------------------------------------------
 * Só web/Electron: escrever um ficheiro passa pelo DOM (Blob + <a download>).
 * No telemóvel não há disco onde o pôr — quem chama tem de olhar para o
 * `excelDisponivel` antes de mostrar um botão.
 *
 * A app exporta **só Excel**, de propósito. O CSV que aqui esteve dava uma
 * folha sem cabeçalhos legíveis, sem larguras e, pior, com o separador e a
 * vírgula decimal à mercê da configuração regional de quem o abria — o mesmo
 * ficheiro abria em colunas num computador e numa coluna só noutro.
 *
 * A escrita usa `xlsx-js-style` (o SheetJS gratuito não escreve estilos, e sem
 * eles o cabeçalho não se distingue dos dados). A LEITURA fica no `xlsx`
 * 0.20.3 — ver `animalExcelFicheiro.ts`.
 */

import type * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';

/** true num ambiente com DOM (web/Electron) — onde descarregar/ler funciona. */
export const excelDisponivel = typeof document !== 'undefined' && typeof window !== 'undefined';

export const COR = {
  verde: '1B7A48', // marca — cabeçalhos obrigatórios
  cinza: 'E3EAE0', // cabeçalhos opcionais
  texto: '15251C',
  branco: 'FFFFFF',
} as const;

export type EstiloCelula = {
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
export function estiloCabecalho(obrigatorio: boolean): EstiloCelula {
  return {
    font: { bold: true, sz: 11, color: { rgb: obrigatorio ? COR.branco : COR.texto } },
    fill: { patternType: 'solid', fgColor: { rgb: obrigatorio ? COR.verde : COR.cinza } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };
}

/** Aplica um estilo a uma célula pela sua posição (linha/coluna, base 0). */
export function estilizar(ws: XLSX.WorkSheet, r: number, c: number, s: EstiloCelula): void {
  const ref = XLSXStyle.utils.encode_cell({ r, c });
  const cel = ws[ref] as CelulaComEstilo | undefined;
  if (cel) cel.s = s;
}

/**
 * Bytes, venha o resultado do SheetJS como for (Buffer, ArrayBuffer, array) —
 * o `type: 'array'` devolve coisas diferentes conforme o ambiente. O `as` é
 * sobre a origem do buffer, que o TS distingue mas aqui é sempre um `ArrayBuffer`.
 */
export function bytes(v: unknown): Uint8Array<ArrayBuffer> {
  if (v instanceof Uint8Array) return v as Uint8Array<ArrayBuffer>;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return new Uint8Array(v as number[]);
}

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Descarrega bytes como ficheiro `.xlsx`. Não faz nada sem DOM. */
export function descarregarBytes(nomeFicheiro: string, dados: Uint8Array<ArrayBuffer>): void {
  if (!excelDisponivel) return;
  const blob = new Blob([dados], { type: MIME_XLSX });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Uma tabela simples pronta a escrever: cabeçalhos e linhas já formatadas. */
export type Tabela = {
  cabecalhos: string[];
  linhas: (string | number)[][];
};

/**
 * Folha de uma tabela simples: cabeçalho a verde e colunas com largura
 * suficiente para o conteúdo (o Excel abre tudo em 8 caracteres e o criador via
 * "########" em vez das datas).
 */
export function folhaDeTabela({ cabecalhos, linhas }: Tabela): XLSX.WorkSheet {
  const ws = XLSXStyle.utils.aoa_to_sheet([cabecalhos, ...linhas]);
  ws['!cols'] = cabecalhos.map((h, i) => {
    const maisLongo = linhas.reduce((m, l) => Math.max(m, String(l[i] ?? '').length), h.length);
    return { wch: Math.min(60, Math.max(12, maisLongo + 2)) };
  });
  ws['!rows'] = [{ hpt: 22 }];
  cabecalhos.forEach((_, i) => estilizar(ws, 0, i, estiloCabecalho(true)));
  return ws;
}

/** Escreve e descarrega uma folha única com uma tabela simples. */
export function descarregarTabelaExcel(
  nomeFicheiro: string,
  nomeFolha: string,
  tabela: Tabela,
): void {
  if (!excelDisponivel) return;
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, folhaDeTabela(tabela), nomeFolha);
  descarregarBytes(nomeFicheiro, bytes(XLSXStyle.write(wb, { type: 'array', bookType: 'xlsx' })));
}
