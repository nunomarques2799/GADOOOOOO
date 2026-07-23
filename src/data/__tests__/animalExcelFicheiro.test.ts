import { describe, expect, it } from '@jest/globals';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';

import { COLUNAS, EXEMPLOS, interpretarMatriz } from '../animalExcel';
import { construirTemplate } from '../animalExcelFicheiro';

/**
 * Round-trip real do SheetJS: gerar um workbook, escrevê-lo em bytes, relê-lo
 * como o `lerFicheiroExcel` faz (cellDates) e passá-lo pela interpretação. É o
 * que garante que o que se EXPORTA é exatamente o que a IMPORTAÇÃO reconhece —
 * sem browser nem sessão, que é o que este teste não consegue ter.
 */
function roundTrip(wb: XLSX.WorkBook) {
  // Escreve com estilos (o caminho da app) e lê com o xlsx seguro.
  const buf = XLSXStyle.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const lido = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
  const nome =
    lido.SheetNames.find((n) => n.trim().toLowerCase() === 'animais') ?? lido.SheetNames[0];
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(lido.Sheets[nome], {
    header: 1,
    raw: true,
    blankrows: false,
    defval: '',
  });
  return interpretarMatriz(matriz);
}

describe('round-trip Excel (SheetJS)', () => {
  it('o template gerado é lido sem colunas obrigatórias em falta', () => {
    const r = roundTrip(construirTemplate());
    expect(r.colunasEmFalta).toEqual([]);
    expect(r.colunasIgnoradas).toEqual([]);
    // Só cabeçalhos: nada para importar, mas também nada com erro.
    expect(r.linhas).toHaveLength(0);
  });

  it('escreve e relê uma linha, incluindo a data como célula de data do Excel', () => {
    const wb = construirTemplate();
    const ws = wb.Sheets['Animais'];
    // Acrescenta uma linha de dados na folha "Animais", na ordem das colunas.
    // A data vai como Date (é assim que o Excel a guarda quando se escreve uma).
    const linha = COLUNAS.map((c) => {
      if (c.campo === 'dataNascimento') return new Date(2021, 2, 15);
      return EXEMPLOS[0][c.campo] ?? '';
    });
    XLSX.utils.sheet_add_aoa(ws, [linha], { origin: -1 });

    const r = roundTrip(wb);
    expect(r.validas).toBe(1);
    expect(r.comErro).toBe(0);
    const [primeira] = r.linhas;
    expect(primeira.dados?.nome).toBe('Mimosa');
    expect(primeira.dados?.especie).toBe('Bovino');
    expect(primeira.dados?.finalidade).toBe('Leite');
    expect(new Date(primeira.dados!.dataNascimento).getFullYear()).toBe(2021);
    expect(new Date(primeira.dados!.dataNascimento).getMonth()).toBe(2); // março
  });
});
