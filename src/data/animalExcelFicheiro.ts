/**
 * Geração e leitura do ficheiro Excel (SheetJS).
 * ------------------------------------------------------------------
 * Só web/Electron: usa o DOM (Blob + <input type="file">) para escrever e ler
 * ficheiros. No telemóvel, escolher um ficheiro precisa de um módulo nativo
 * (expo-document-picker) e de um build novo — por isso, para já, a importação
 * é do computador. A validação vive em `animalExcel.ts`, testável e sem esta
 * dependência; aqui só se converte o `.xlsx` numa matriz de células.
 */

import * as XLSX from 'xlsx';

import {
  COLUNAS,
  EXEMPLOS,
  interpretarMatriz,
  type ResultadoImportacao,
} from './animalExcel';
import { hojeISO } from './exportar';

const NOME_FOLHA = 'Animais';

/** true num ambiente com DOM (web/Electron) — onde descarregar/ler funciona. */
export const importacaoDisponivel =
  typeof document !== 'undefined' && typeof window !== 'undefined';

/** Resultado vazio, com todas as colunas obrigatórias marcadas em falta. */
function resultadoVazio(): ResultadoImportacao {
  return {
    linhas: [],
    validas: 0,
    comErro: 0,
    colunasEmFalta: COLUNAS.filter((c) => c.obrigatorio).map((c) => c.rotulo),
    colunasIgnoradas: [],
  };
}

/** Constrói o workbook do template: folha de dados (só cabeçalhos) + instruções.
 *  Exportado para o teste de round-trip (gerar → reler → interpretar). */
export function construirTemplate(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const cabecalhos = COLUNAS.map((c) => c.rotulo);

  // Folha 1 — onde o criador escreve. Só a linha de cabeçalhos: sem linhas de
  // exemplo, para não haver nada a ser importado por engano quem se esquece de
  // as apagar. Os exemplos vivem na folha de instruções.
  const wsDados = XLSX.utils.aoa_to_sheet([cabecalhos]);
  wsDados['!cols'] = COLUNAS.map((c) => ({ wch: Math.max(14, c.rotulo.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsDados, NOME_FOLHA);

  // Folha 2 — instruções: o que cada coluna quer, e duas linhas de exemplo.
  const linhasInstr: (string | undefined)[][] = [
    ['Como preencher'],
    ['Escreva um animal por linha na folha "Animais". As datas em dd/mm/aaaa.'],
    [''],
    ['Coluna', 'Obrigatória?', 'O que escrever'],
    ...COLUNAS.map((c) => [c.rotulo, c.obrigatorio ? 'Sim' : 'Não', c.ajuda]),
    [''],
    ['Exemplos:'],
    cabecalhos,
    ...EXEMPLOS.map((ex) => COLUNAS.map((c) => ex[c.campo] ?? '')),
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(linhasInstr);
  wsInstr['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');

  return wb;
}

/** Gera o template e descarrega-o como .xlsx. Sem efeito fora da web/Electron. */
export function descarregarTemplate(): void {
  if (!importacaoDisponivel) return;
  const wb = construirTemplate();
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modelo-animais-${hojeISO()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê um ficheiro já escolhido e interpreta-o (colunas + validação por linha). */
export async function lerFicheiroExcel(file: File): Promise<ResultadoImportacao> {
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
  return interpretarMatriz(matriz);
}

/**
 * Abre o seletor de ficheiros do sistema e devolve o resultado da leitura, ou
 * `null` se o criador cancelar. Só web/Electron.
 */
export function escolherELerExcel(): Promise<ResultadoImportacao | null> {
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
      lerFicheiroExcel(file).then(resolve, reject);
    };
    // Browsers modernos disparam 'cancel' ao fechar o diálogo sem escolher —
    // sem isto a promessa ficava pendente para sempre nesse caso.
    input.oncancel = () => {
      limpar();
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}
