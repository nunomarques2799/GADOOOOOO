import { describe, expect, it } from '@jest/globals';

import {
  contarAtivos,
  faixaDe,
  filtrarAnimais,
  mapaAlertas,
  SEM_TERRENO,
  valoresPresentes,
  type Filtros,
} from '../filtrosAnimais';
import { isoDaysAgo } from '../helpers';
import type { Alerta, Animal } from '../types';

function animal(id: string, over: Partial<Animal> = {}): Animal {
  return {
    id,
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: isoDaysAgo(1000),
    ...over,
  };
}

const semAlertas = new Map<string, Set<Alerta['categoria']>>();

/** Atalho: filtra e devolve só os ids, que é o que interessa afirmar. */
function ids(animais: Animal[], f: Filtros, m = semAlertas): string[] {
  return filtrarAnimais(animais, f, m).map((a) => a.id);
}

describe('faixaDe', () => {
  it('separa as idades pelas faixas anunciadas', () => {
    expect(faixaDe(animal('a', { dataNascimento: isoDaysAgo(30) }))).toBe('cria');
    expect(faixaDe(animal('a', { dataNascimento: isoDaysAgo(300) }))).toBe('jovem');
    expect(faixaDe(animal('a', { dataNascimento: isoDaysAgo(1500) }))).toBe('adulto');
    expect(faixaDe(animal('a', { dataNascimento: isoDaysAgo(4000) }))).toBe('velho');
  });

  it('o limite pertence à faixa de cima', () => {
    // 24 meses certos é adulto, não jovem — senão havia uma idade que não
    // cabia em faixa nenhuma e o animal sumia de todos os filtros de idade.
    const doisAnos = animal('a', { dataNascimento: isoDaysAgo(Math.round(24 * 30.44)) });
    expect(faixaDe(doisAnos)).toBe('adulto');
  });
});

describe('arquivo (falecidos e vendidos)', () => {
  const efetivo = [
    animal('vivo'),
    animal('morto', { estado: 'falecido' }),
    animal('vendido', { estado: 'vendido' }),
  ];

  it('por omissão mostra só o efetivo ativo', () => {
    expect(ids(efetivo, {})).toEqual(['vivo']);
  });

  it('com o arquivo ligado mostra tudo', () => {
    expect(ids(efetivo, { incluirSaidos: true })).toEqual(['vivo', 'morto', 'vendido']);
  });

  it('nenhum outro filtro consegue ressuscitar um animal que saiu', () => {
    // A guarda do arquivo é a primeira de todas de propósito. Se um filtro
    // qualquer conseguisse trazer um animal vendido de volta ao efetivo, o
    // criador contava-o como se ainda o tivesse.
    expect(ids(efetivo, { sexo: 'Fêmea' })).toEqual(['vivo']);
    expect(ids(efetivo, { especie: 'Bovino' })).toEqual(['vivo']);
  });
});

describe('filtros simples', () => {
  const efetivo = [
    animal('f1', { sexo: 'Fêmea', raca: 'Mertolenga', corPelagem: 'Malhada' }),
    animal('m1', { sexo: 'Macho', raca: 'Minhota', corPelagem: 'Preta' }),
    animal('o1', { especie: 'Ovino', sexo: 'Fêmea', raca: 'Serra da Estrela' }),
  ];

  it('sexo', () => {
    expect(ids(efetivo, { sexo: 'Macho' })).toEqual(['m1']);
  });

  it('espécie', () => {
    expect(ids(efetivo, { especie: 'Ovino' })).toEqual(['o1']);
  });

  it('raça e cor ignoram maiúsculas e acentos', () => {
    // A raça pode ter sido escrita à mão antes de haver lista. Se o filtro
    // comparasse literalmente, esses animais desapareciam sem explicação.
    expect(ids(efetivo, { raca: 'MERTOLENGA' })).toEqual(['f1']);
    expect(ids(efetivo, { cor: 'malhada' })).toEqual(['f1']);
  });

  it('combinam-se entre si', () => {
    expect(ids(efetivo, { sexo: 'Fêmea', especie: 'Bovino' })).toEqual(['f1']);
  });
});

describe('prenhez', () => {
  const efetivo = [
    animal('coberta', { sexo: 'Fêmea', dataPrevistaParto: isoDaysAgo(-30) }),
    animal('vazia', { sexo: 'Fêmea' }),
    animal('touro', { sexo: 'Macho' }),
  ];

  it('cobertas', () => {
    expect(ids(efetivo, { prenhe: true })).toEqual(['coberta']);
  });

  it('não cobertas não traz os machos à mistura', () => {
    // Um macho é, tecnicamente, "não coberto". Devolvê-lo aqui tornava o
    // filtro inútil — quem o usa quer saber que fêmeas faltam cobrir.
    expect(ids(efetivo, { prenhe: false })).toEqual(['vazia']);
  });
});

describe('terreno', () => {
  const efetivo = [
    animal('no-lameiro', { terrenoId: 't1' }),
    animal('na-courela', { terrenoId: 't2' }),
    animal('solto'),
  ];

  it('por terreno', () => {
    expect(ids(efetivo, { terrenoId: 't1' })).toEqual(['no-lameiro']);
  });

  it('sem terreno atribuído', () => {
    expect(ids(efetivo, { terrenoId: SEM_TERRENO })).toEqual(['solto']);
  });
});

describe('alertas', () => {
  const efetivo = [animal('a1'), animal('a2'), animal('a3')];
  const alertas: Alerta[] = [
    { id: 'x1', animalId: 'a1', categoria: 'vacinacao', gravidade: 'info', titulo: '', descricao: '' },
    { id: 'x2', animalId: 'a2', categoria: 'identificacao', gravidade: 'urgente', titulo: '', descricao: '' },
    { id: 'x3', animalId: 'a2', categoria: 'snira', gravidade: 'aviso', titulo: '', descricao: '' },
  ];
  const m = mapaAlertas(alertas);

  it('com qualquer alerta', () => {
    expect(ids(efetivo, { alerta: true }, m)).toEqual(['a1', 'a2']);
  });

  it('por categoria', () => {
    expect(ids(efetivo, { alerta: 'vacinacao' }, m)).toEqual(['a1']);
    expect(ids(efetivo, { alerta: 'snira' }, m)).toEqual(['a2']);
  });

  it('um animal com vários alertas aparece em cada categoria sua', () => {
    expect(ids(efetivo, { alerta: 'identificacao' }, m)).toEqual(['a2']);
  });

  it('quem não tem alertas fica de fora', () => {
    expect(ids(efetivo, { alerta: 'medicamento' }, m)).toEqual([]);
  });
});

describe('pesquisa por texto', () => {
  const efetivo = [
    animal('a1', { nome: 'Mimosa', numeroIdentificacao: 'PT123', casa: 'Casa do Monte' }),
    animal('a2', { nome: 'Estrela', raca: 'Barrosã' }),
  ];

  it('procura no nome, brinco, raça e casa', () => {
    expect(ids(efetivo, { texto: 'mimo' })).toEqual(['a1']);
    expect(ids(efetivo, { texto: 'PT123' })).toEqual(['a1']);
    expect(ids(efetivo, { texto: 'monte' })).toEqual(['a1']);
    expect(ids(efetivo, { texto: 'barrosa' })).toEqual(['a2']); // sem acento
  });

  it('não encontrar devolve lista vazia, não a lista toda', () => {
    expect(ids(efetivo, { texto: 'zzz' })).toEqual([]);
  });
});

describe('contarAtivos', () => {
  it('conta os filtros que estreitam a lista', () => {
    expect(contarAtivos({})).toBe(0);
    expect(contarAtivos({ sexo: 'Fêmea' })).toBe(1);
    expect(contarAtivos({ sexo: 'Fêmea', raca: 'Minhota', alerta: true })).toBe(3);
  });

  it('"não cobertas" conta, apesar de ser false', () => {
    // `prenhe: false` é um filtro tão ativo como `prenhe: true`. Um `if (f.prenhe)`
    // distraído deixava o botão a dizer que não havia filtros nenhuns.
    expect(contarAtivos({ prenhe: false })).toBe(1);
  });

  it('o arquivo e a pesquisa não contam', () => {
    // O arquivo ALARGA a lista, e a pesquisa já se lê na própria caixa.
    expect(contarAtivos({ incluirSaidos: true, texto: 'mimosa' })).toBe(0);
  });
});

describe('valoresPresentes', () => {
  it('devolve só o que existe mesmo no efetivo, sem repetir', () => {
    const efetivo = [
      animal('a1', { raca: 'Mertolenga', corPelagem: 'Preta', casa: 'Monte' }),
      animal('a2', { raca: 'mertolenga', corPelagem: 'Preta' }),
      animal('a3', { raca: 'Minhota' }),
    ];
    const v = valoresPresentes(efetivo);
    expect(v.racas).toEqual(['Mertolenga', 'Minhota']);
    expect(v.cores).toEqual(['Preta']);
    expect(v.casas).toEqual(['Monte']);
  });
});
