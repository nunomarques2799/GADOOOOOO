import { describe, expect, it } from '@jest/globals';

import {
  interpretarMatriz,
  linhaParaAnimal,
  COLUNAS,
  type AnimalExistente,
} from '../animalExcel';

/** Atalho: monta a matriz (cabeçalhos + linhas) e interpreta. */
function interpretar(cabecalhos: string[], ...linhas: unknown[][]) {
  return interpretarMatriz([cabecalhos, ...linhas]);
}

const MINIMO = ['Espécie', 'Sexo', 'Data de nascimento'];

describe('interpretarMatriz — casos válidos', () => {
  it('lê uma linha mínima válida', () => {
    const r = interpretar(MINIMO, ['Bovino', 'Fêmea', '15/03/2021']);
    expect(r.validas).toBe(1);
    expect(r.comErro).toBe(0);
    expect(r.colunasEmFalta).toEqual([]);
    const [linha] = r.linhas;
    expect(linha.numero).toBe(2); // cabeçalho é a linha 1
    expect(linha.dados?.especie).toBe('Bovino');
    expect(linha.dados?.sexo).toBe('Fêmea');
    expect(new Date(linha.dados!.dataNascimento).getFullYear()).toBe(2021);
  });

  it('aceita M/F e cabeçalhos por alias, sem acentos e em minúsculas', () => {
    const r = interpretar(['especie', 'sexo', 'nascimento', 'brinco'], [
      'bovino',
      'M',
      '01/02/2020',
      'PT 1234',
    ]);
    expect(r.validas).toBe(1);
    expect(r.linhas[0].dados?.sexo).toBe('Macho');
    expect(r.linhas[0].dados?.numeroIdentificacao).toBe('PT 1234');
  });

  it('aceita datas vindas como objeto Date (formato do Excel)', () => {
    const r = interpretar(MINIMO, ['Ovino', 'Fêmea', new Date(2019, 5, 10)]);
    expect(r.validas).toBe(1);
    expect(new Date(r.linhas[0].dados!.dataNascimento).getFullYear()).toBe(2019);
  });

  it('salta linhas totalmente vazias', () => {
    const r = interpretar(MINIMO, ['', '', ''], ['Caprino', 'Macho', '03/03/2020']);
    expect(r.linhas).toHaveLength(1);
    expect(r.validas).toBe(1);
  });
});

describe('interpretarMatriz — validação', () => {
  it('marca a espécie em falta', () => {
    const r = interpretar(MINIMO, ['', 'Fêmea', '15/03/2021']);
    expect(r.comErro).toBe(1);
    expect(r.linhas[0].dados).toBeUndefined();
    expect(r.linhas[0].erros.join(' ')).toMatch(/espécie/i);
  });

  it('rejeita uma espécie inválida', () => {
    const r = interpretar(MINIMO, ['Vaca', 'Fêmea', '15/03/2021']);
    expect(r.comErro).toBe(1);
    expect(r.linhas[0].erros.join(' ')).toMatch(/não é válida/i);
  });

  it('rejeita uma data de nascimento futura', () => {
    const r = interpretar(MINIMO, ['Bovino', 'Fêmea', '01/01/2099']);
    expect(r.comErro).toBe(1);
    expect(r.linhas[0].erros.join(' ')).toMatch(/inválida/i);
  });

  it('reporta colunas obrigatórias em falta', () => {
    const r = interpretar(['Espécie', 'Data de nascimento'], ['Bovino', '15/03/2021']);
    expect(r.colunasEmFalta).toContain('Sexo');
  });

  it('lista cabeçalhos desconhecidos como ignorados', () => {
    const r = interpretar([...MINIMO, 'Peso'], ['Bovino', 'Fêmea', '15/03/2021', '450']);
    expect(r.colunasIgnoradas).toContain('Peso');
    expect(r.validas).toBe(1); // a coluna a mais não impede a importação
  });
});

describe('linhaParaAnimal — regras de domínio', () => {
  it('com brinco e sem coluna SNIRA assume comunicado e identifica à nascença', () => {
    const nasc = '15/03/2021';
    const l = linhaParaAnimal(
      { especie: 'Bovino', sexo: 'Fêmea', dataNascimento: nasc, numeroIdentificacao: 'PT 9' },
      2,
    );
    expect(l.dados?.comunicadoSnira).toBe(true);
    expect(l.dados?.dataIdentificacao).toBe(l.dados?.dataNascimento);
  });

  it('sem brinco não mexe no SNIRA nem na data de identificação', () => {
    const l = linhaParaAnimal(
      { especie: 'Bovino', sexo: 'Macho', dataNascimento: '15/03/2021' },
      2,
    );
    expect(l.dados?.comunicadoSnira).toBeUndefined();
    expect(l.dados?.dataIdentificacao).toBeUndefined();
  });

  it('ignora a finalidade em animais que não são bovinos, com aviso', () => {
    const l = linhaParaAnimal(
      { especie: 'Ovino', sexo: 'Fêmea', dataNascimento: '15/03/2021', finalidade: 'Leite' },
      2,
    );
    expect(l.dados).toBeDefined();
    expect(l.dados?.finalidade).toBeUndefined();
    expect(l.avisos.join(' ')).toMatch(/bovino/i);
  });

  it('guarda uma finalidade atípica do sexo, mas avisa', () => {
    const l = linhaParaAnimal(
      { especie: 'Bovino', sexo: 'Macho', dataNascimento: '15/03/2021', finalidade: 'Leite' },
      2,
    );
    expect(l.dados?.finalidade).toBe('Leite');
    expect(l.avisos.join(' ')).toMatch(/típica/i);
  });

  it('ignora a data de parto num macho', () => {
    const l = linhaParaAnimal(
      {
        especie: 'Bovino',
        sexo: 'Macho',
        dataNascimento: '15/03/2018',
        dataPrevistaParto: '01/01/2099',
      },
      2,
    );
    expect(l.dados?.dataPrevistaParto).toBeUndefined();
    expect(l.avisos.join(' ')).toMatch(/macho/i);
  });
});

describe('interpretarMatriz — duplicados (brinco)', () => {
  const COM_BRINCO = [...MINIMO, 'Nº de brinco (SIA)'];

  /** Um animal que já está na conta, com o mínimo que a deteção precisa. */
  function jaNaConta(p: Partial<AnimalExistente> = {}): AnimalExistente {
    return {
      id: 'a1',
      especie: 'Bovino',
      dataNascimento: new Date(2021, 2, 15).toISOString(),
      ...p,
    };
  }

  it('salta um brinco que já existe na conta', () => {
    const r = interpretarMatriz([COM_BRINCO, ['Bovino', 'Fêmea', '15/03/2021', 'PT 1']], [
      jaNaConta({ numeroIdentificacao: 'PT 1' }),
    ]);
    expect(r.validas).toBe(0);
    expect(r.duplicadas).toBe(1);
    expect(r.linhas[0].duplicado).toBe('ja-existe');
    expect(r.linhas[0].duplicadoPor).toBe('brinco');
    expect(r.linhas[0].dados).toBeUndefined();
  });

  it('reconhece o mesmo brinco escrito com espaçamento diferente', () => {
    const r = interpretarMatriz([COM_BRINCO, ['Bovino', 'Fêmea', '15/03/2021', 'pt0001']], [
      jaNaConta({ numeroIdentificacao: 'PT 00 01' }),
    ]);
    expect(r.duplicadas).toBe(1);
  });

  it('salta a segunda ocorrência do mesmo brinco dentro do ficheiro', () => {
    const r = interpretarMatriz([
      COM_BRINCO,
      ['Bovino', 'Fêmea', '15/03/2021', 'PT 9'],
      ['Bovino', 'Macho', '16/03/2021', 'PT 9'],
    ]);
    expect(r.validas).toBe(1);
    expect(r.duplicadas).toBe(1);
    expect(r.linhas[1].duplicado).toBe('no-ficheiro');
  });

  it('com brincos diferentes, dois animais com o mesmo nome entram os dois', () => {
    // O brinco é a autoridade: dois "Mimosa" com brincos diferentes são dois
    // animais, e recusar o segundo era perder um animal do efetivo.
    const cab = [...COM_BRINCO, 'Nome'];
    const r = interpretarMatriz(
      [
        cab,
        ['Bovino', 'Fêmea', '15/03/2021', 'PT 1', 'Mimosa'],
        ['Bovino', 'Fêmea', '15/03/2021', 'PT 2', 'Mimosa'],
      ],
      [],
    );
    expect(r.validas).toBe(2);
    expect(r.duplicadas).toBe(0);
  });
});

describe('interpretarMatriz — duplicados sem brinco (nome + nascimento)', () => {
  const COM_NOME = ['Nome', ...MINIMO];

  it('salta um animal sem brinco que já existe com o mesmo nome e nascimento', () => {
    const r = interpretarMatriz([COM_NOME, ['Mimosa', 'Bovino', 'Fêmea', '15/03/2021']], [
      {
        id: 'a1',
        especie: 'Bovino',
        nome: 'Mimosa',
        dataNascimento: new Date(2021, 2, 15).toISOString(),
      },
    ]);
    expect(r.validas).toBe(0);
    expect(r.duplicadas).toBe(1);
    expect(r.linhas[0].duplicadoPor).toBe('nome-data');
  });

  it('deixa entrar o mesmo nome com data de nascimento diferente', () => {
    const r = interpretarMatriz([COM_NOME, ['Mimosa', 'Bovino', 'Fêmea', '15/03/2020']], [
      {
        id: 'a1',
        especie: 'Bovino',
        nome: 'Mimosa',
        dataNascimento: new Date(2021, 2, 15).toISOString(),
      },
    ]);
    expect(r.validas).toBe(1);
    expect(r.duplicadas).toBe(0);
  });

  it('salta a linha repetida dentro do próprio ficheiro', () => {
    const r = interpretarMatriz([
      COM_NOME,
      ['Mimosa', 'Bovino', 'Fêmea', '15/03/2021'],
      ['mimosa', 'Bovino', 'Fêmea', '15/03/2021'],
    ]);
    expect(r.validas).toBe(1);
    expect(r.linhas[1].duplicado).toBe('no-ficheiro');
    expect(r.linhas[1].duplicadoPor).toBe('nome-data');
  });

  it('sem brinco nem nome, importa mas avisa que não dá para confirmar', () => {
    const r = interpretarMatriz([
      MINIMO,
      ['Bovino', 'Fêmea', '15/03/2021'],
      ['Bovino', 'Fêmea', '15/03/2021'],
    ]);
    expect(r.validas).toBe(2);
    expect(r.duplicadas).toBe(0);
    expect(r.linhas[0].avisos.join(' ')).toMatch(/não conseguimos confirmar/i);
  });
});

describe('interpretarMatriz — duplicados por ID (ficheiro exportado pela app)', () => {
  const COM_ID = [...MINIMO, 'ID Terrabovina'];

  it('salta as linhas cujo ID já está na conta e importa as que o criador acrescentou', () => {
    // O caso real: exportar o efetivo, escrever animais novos no fim do
    // ficheiro e reimportar o ficheiro TODO. Sem isto, os animais já
    // registados entravam segunda vez.
    const r = interpretarMatriz(
      [
        COM_ID,
        ['Bovino', 'Fêmea', '15/03/2021', 'animal-1'],
        ['Bovino', 'Macho', '16/03/2021', 'animal-2'],
        ['Bovino', 'Fêmea', '01/04/2024', ''], // linha nova, sem ID
      ],
      [
        { id: 'animal-1', especie: 'Bovino', dataNascimento: '2021-03-15' },
        { id: 'animal-2', especie: 'Bovino', dataNascimento: '2021-03-16' },
      ],
    );
    expect(r.duplicadas).toBe(2);
    expect(r.validas).toBe(1);
    expect(r.linhas[0].duplicadoPor).toBe('id');
    expect(r.linhas[2].dados).toBeDefined();
  });

  it('a coluna do ID não conta como coluna desconhecida', () => {
    const r = interpretarMatriz([COM_ID, ['Bovino', 'Fêmea', '15/03/2021', 'x']]);
    expect(r.colunasIgnoradas).toEqual([]);
  });

  it('as colunas informativas da exportação também não', () => {
    const r = interpretarMatriz([
      [...MINIMO, 'Exploração', 'Terreno', 'Estado'],
      ['Bovino', 'Fêmea', '15/03/2021', 'Quinta do Alto', 'Lameiro', 'Ativo'],
    ]);
    expect(r.colunasIgnoradas).toEqual([]);
    expect(r.validas).toBe(1);
  });
});

describe('COLUNAS', () => {
  it('tem exatamente três colunas obrigatórias: espécie, sexo e nascimento', () => {
    const obrig = COLUNAS.filter((c) => c.obrigatorio).map((c) => c.campo);
    expect(obrig).toEqual(['especie', 'sexo', 'dataNascimento']);
  });
});
