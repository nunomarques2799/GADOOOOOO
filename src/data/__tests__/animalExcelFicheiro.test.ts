import { describe, expect, it } from '@jest/globals';
import * as XLSX from 'xlsx';

import { COLUNAS, EXEMPLOS, interpretarMatriz } from '../animalExcel';
import { construirTemplate, escreverWorkbook } from '../animalExcelFicheiro';

/**
 * Round-trip real do SheetJS: gerar um workbook, escrevê-lo em bytes, relê-lo
 * como o `lerFicheiroExcel` faz (cellDates) e passá-lo pela interpretação. É o
 * que garante que o que se EXPORTA é exatamente o que a IMPORTAÇÃO reconhece —
 * sem browser nem sessão, que é o que este teste não consegue ter.
 */
function roundTrip(wb: XLSX.WorkBook) {
  // Escreve pelo caminho da app (estilos + listas pendentes) e lê com o xlsx seguro.
  const lido = XLSX.read(escreverWorkbook(wb), { type: 'array', cellDates: true });
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

/** O XML da folha "Animais" dentro do .xlsx gerado (é um zip). */
function xmlDaFolhaAnimais(wb: XLSX.WorkBook): string {
  const zip = XLSX.CFB.read(escreverWorkbook(wb), { type: 'array' });
  const indice = wb.SheetNames.indexOf('Animais');
  const entrada = XLSX.CFB.find(zip, `/xl/worksheets/sheet${indice + 1}.xml`);
  return new TextDecoder().decode(new Uint8Array(entrada.content));
}

describe('listas pendentes (dropdowns)', () => {
  const xml = xmlDaFolhaAnimais(construirTemplate());

  it('cada coluna com opções aponta a dropdown para a folha "Listas"', () => {
    const comOpcoes = COLUNAS.filter((c) => c.opcoes);
    expect(comOpcoes.length).toBeGreaterThan(0);
    for (const c of comOpcoes) {
      const i = COLUNAS.indexOf(c);
      const col = XLSX.utils.encode_col(i);
      const bloco = xml.match(
        new RegExp(`<dataValidation type="list"[^>]*sqref="${col}2:${col}\\d+">.*?</dataValidation>`),
      );
      expect(bloco?.[0]).toContain(`<formula1>Listas!$`);
      expect(bloco?.[0]).toContain(`$2:$`);
    }
  });

  it('a folha "Listas" traz os valores que as dropdowns oferecem', () => {
    const lido = XLSX.read(escreverWorkbook(construirTemplate()), { type: 'array' });
    expect(lido.SheetNames).toContain('Listas');
    const valores = XLSX.utils
      .sheet_to_json<unknown[]>(lido.Sheets['Listas'], { header: 1 })
      .flat()
      .map(String);
    expect(valores).toContain('Bovino');
    expect(valores).toContain('Fêmea');
    expect(valores).toContain('Mertolenga');
  });

  it('a espécie recusa o que não conhece e a raça deixa escrever', () => {
    const bloco = (rotulo: string) => {
      const col = XLSX.utils.encode_col(COLUNAS.findIndex((c) => c.rotulo === rotulo));
      return xml.match(new RegExp(`<dataValidation[^>]*sqref="${col}2:${col}\\d+"`))?.[0] ?? '';
    };
    // Espécie é enum na app: escrever "AAAA" tem de dar erro logo no Excel.
    expect(bloco('Espécie')).toContain('showErrorMessage="1"');
    // Raça é texto livre (raças locais e cruzados): a lista sugere, não obriga.
    expect(bloco('Raça')).toContain('showErrorMessage="0"');
  });

  it('o bloco fica antes de <ignoredErrors> (fora de ordem, o Excel pede para reparar)', () => {
    const dv = xml.indexOf('<dataValidations');
    const ign = xml.indexOf('<ignoredErrors');
    expect(dv).toBeGreaterThan(0);
    expect(ign).toBeGreaterThan(0);
    expect(dv).toBeLessThan(ign);
  });
});
