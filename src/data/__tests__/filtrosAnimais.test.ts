import { describe, expect, it } from '@jest/globals';

import {
  contarAtivos,
  facetasDisponiveis,
  faixaDe,
  filtrarAnimais,
  mapaAlertas,
  mapaGravidade,
  ordenarAnimais,
  SEM_TERRENO,
  type Filtros,
} from '../filtrosAnimais';
import { isoDaysAgo, isoInDays } from '../helpers';
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

  it('uma idade negativa cai na primeira faixa, não na última', () => {
    // Só acontece com o relógio do aparelho desacertado, mas o recurso importa:
    // um recém-nascido classificado como "mais de 8 anos" desaparecia do filtro
    // onde o criador o ia procurar.
    expect(faixaDe(animal('a', { dataNascimento: isoInDays(3) }))).toBe('cria');
  });
});

describe('ordenarAnimais', () => {
  const semGravidade = new Map<string, number>();

  it('por nome, com o brinco a substituir quem não tem nome', () => {
    const efetivo = [
      animal('c', { nome: 'Zita' }),
      animal('a', { nome: 'Bela' }),
      animal('b', { nome: undefined, numeroIdentificacao: 'AA1' }),
    ];
    expect(ordenarAnimais(efetivo, 'nome', semGravidade).map((a) => a.id)).toEqual([
      'b', // "AA1"
      'a', // "Bela"
      'c', // "Zita"
    ]);
  });

  it('"mais novos" põe o nascido há menos tempo em primeiro', () => {
    const efetivo = [
      animal('velho', { dataNascimento: isoDaysAgo(3000) }),
      animal('novo', { dataNascimento: isoDaysAgo(30) }),
      animal('meio', { dataNascimento: isoDaysAgo(600) }),
    ];
    expect(ordenarAnimais(efetivo, 'novos', semGravidade).map((a) => a.id)).toEqual([
      'novo',
      'meio',
      'velho',
    ]);
    expect(ordenarAnimais(efetivo, 'velhos', semGravidade).map((a) => a.id)).toEqual([
      'velho',
      'meio',
      'novo',
    ]);
  });

  it('"com alertas primeiro" ordena pelo pior alerta, depois pelo nome', () => {
    const efetivo = [
      animal('semNada', { nome: 'Ana' }),
      animal('urgente', { nome: 'Zeca' }),
      animal('aviso', { nome: 'Bento' }),
    ];
    const grav = mapaGravidade([
      { id: '1', animalId: 'urgente', categoria: 'snira', gravidade: 'urgente', titulo: '', descricao: '' },
      { id: '2', animalId: 'aviso', categoria: 'vacinacao', gravidade: 'aviso', titulo: '', descricao: '' },
    ]);
    // Urgente > aviso > sem alerta; sem alerta cai para o fim mesmo começando por 'A'.
    expect(ordenarAnimais(efetivo, 'alertas', grav).map((a) => a.id)).toEqual([
      'urgente',
      'aviso',
      'semNada',
    ]);
  });

  it('não altera o array que recebe', () => {
    const efetivo = [animal('b', { nome: 'B' }), animal('a', { nome: 'A' })];
    const antes = efetivo.map((a) => a.id);
    ordenarAnimais(efetivo, 'nome', semGravidade);
    expect(efetivo.map((a) => a.id)).toEqual(antes);
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
    animal('a1', { nome: 'Mimosa', numeroIdentificacao: 'PT123', numeroCasa: '17' }),
    animal('a2', { nome: 'Estrela', raca: 'Barrosã' }),
  ];

  it('procura no nome, brinco, raça e número', () => {
    expect(ids(efetivo, { texto: 'mimo' })).toEqual(['a1']);
    expect(ids(efetivo, { texto: 'PT123' })).toEqual(['a1']);
    // O número por que o animal é conhecido na exploração ("a 17"), que é como
    // se procura o gado numerado — não pelos catorze dígitos do brinco.
    expect(ids(efetivo, { texto: '17' })).toEqual(['a1']);
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

  it('o arquivo, a pesquisa e a exploração não contam', () => {
    // O arquivo ALARGA a lista; a pesquisa lê-se na própria caixa; e a
    // exploração está sempre à vista nos chips do topo da lista. Contá-los
    // punha o botão de filtros a anunciar filtros que ninguém escondeu.
    expect(contarAtivos({ incluirSaidos: true, texto: 'mimosa', exploracaoId: 'exp-1' })).toBe(0);
  });
});

describe('exploração', () => {
  const duas = [
    animal('a1', { exploracaoId: 'exp-1' }),
    animal('a2', { exploracaoId: 'exp-2' }),
    animal('a3', { exploracaoId: 'exp-2', estado: 'vendido' }),
  ];

  it('sem escolha mostra o efetivo das duas', () => {
    expect(ids(duas, {})).toEqual(['a1', 'a2']);
  });

  it('escolhida uma exploração, só mostra os animais dela', () => {
    expect(ids(duas, { exploracaoId: 'exp-2' })).toEqual(['a2']);
    expect(ids(duas, { exploracaoId: 'exp-1' })).toEqual(['a1']);
  });

  it('não desfaz a regra do arquivo', () => {
    // O animal vendido da exp-2 só aparece com o arquivo ligado — a exploração
    // estreita a lista, nunca a alarga.
    expect(ids(duas, { exploracaoId: 'exp-2', incluirSaidos: true })).toEqual(['a2', 'a3']);
  });

  it('combina-se com os outros filtros', () => {
    const efetivo = [
      animal('b1', { exploracaoId: 'exp-1', sexo: 'Macho' }),
      animal('b2', { exploracaoId: 'exp-2', sexo: 'Macho' }),
      animal('b3', { exploracaoId: 'exp-2', sexo: 'Fêmea' }),
    ];
    expect(ids(efetivo, { exploracaoId: 'exp-2', sexo: 'Macho' })).toEqual(['b2']);
  });
});

describe('facetasDisponiveis', () => {
  /** Atalho: as facetas sem filtro nenhum e sem alertas. */
  const facetas = (animais: Animal[], f: Filtros = {}, m = semAlertas) =>
    facetasDisponiveis(animais, f, m);

  it('devolve só o que existe mesmo no efetivo, sem repetir', () => {
    const efetivo = [
      animal('a1', { raca: 'Mertolenga', corPelagem: 'Preta' }),
      animal('a2', { raca: 'mertolenga', corPelagem: 'Preta' }),
      animal('a3', { raca: 'Minhota' }),
    ];
    const v = facetas(efetivo);
    expect(v.racas).toEqual(['Mertolenga', 'Minhota']);
    expect(v.cores).toEqual(['Preta']);
  });

  it('o efetivo que já saiu não conta para as opções', () => {
    // Oferecer uma raça que só existe em animais vendidos dá um filtro que
    // devolve zero — e a culpa não é visível em lado nenhum.
    const efetivo = [
      animal('vivo', { raca: 'Mertolenga' }),
      animal('vendido', { raca: 'Minhota', estado: 'vendido' }),
    ];
    expect(facetas(efetivo).racas).toEqual(['Mertolenga']);
    expect(facetas(efetivo).nSaidos).toBe(1);
  });

  it('escolher a espécie tira os sexos que essa espécie não tem', () => {
    // É o caso que motivou tudo isto: uma exploração com bovinos só machos e
    // ovinos fêmeas. Ao filtrar "Bovinos", "Fêmeas" não pode continuar lá.
    const efetivo = [
      animal('boi', { especie: 'Bovino', sexo: 'Macho' }),
      animal('ovelha', { especie: 'Ovino', sexo: 'Fêmea' }),
    ];
    expect(facetas(efetivo).sexos).toEqual(['Fêmea', 'Macho']);
    expect(facetas(efetivo, { especie: 'Bovino' }).sexos).toEqual(['Macho']);
    expect(facetas(efetivo, { especie: 'Ovino' }).sexos).toEqual(['Fêmea']);
  });

  it('a escolha de um grupo não encolhe esse mesmo grupo', () => {
    // Sem isto, escolher "Fêmeas" apagava o chip "Machos" (a lista já só tem
    // fêmeas) e prendia o criador na escolha: para ver os machos tinha de
    // adivinhar que primeiro havia de limpar o filtro.
    const efetivo = [animal('f', { sexo: 'Fêmea' }), animal('m', { sexo: 'Macho' })];
    expect(facetas(efetivo, { sexo: 'Fêmea' }).sexos).toEqual(['Fêmea', 'Macho']);
  });

  it('o filtro escolhido nunca desaparece, mesmo sem devolver nada', () => {
    // Combinação impossível (raça que só existe noutra espécie): a lista fica
    // vazia, mas o chip tem de continuar visível para se poder desligar.
    const efetivo = [
      animal('boi', { especie: 'Bovino', raca: 'Mertolenga' }),
      animal('ovelha', { especie: 'Ovino', raca: 'Serra da Estrela' }),
    ];
    const v = facetas(efetivo, { especie: 'Ovino', raca: 'Mertolenga' });
    expect(v.racas).toContain('Mertolenga');
  });

  it('a cobrição só oferece o que existe entre as fêmeas filtradas', () => {
    const efetivo = [
      animal('coberta', { sexo: 'Fêmea', dataPrevistaParto: isoDaysAgo(-30) }),
      animal('touro', { sexo: 'Macho' }),
    ];
    // Só há uma fêmea e está coberta: "Não cobertas" não tem a quem pertencer.
    expect(facetas(efetivo).prenhez).toEqual([true]);
    // E entre os machos não há cobrição nenhuma para oferecer.
    expect(facetas(efetivo, { sexo: 'Macho' }).prenhez).toEqual([]);
  });

  it('as idades encolhem para as faixas que têm animais', () => {
    const efetivo = [
      animal('cria', { dataNascimento: isoDaysAgo(30) }),
      animal('velho', { dataNascimento: isoDaysAgo(4000) }),
    ];
    expect(facetas(efetivo).idades.sort()).toEqual(['cria', 'velho']);
  });

  it('os terrenos seguem os outros filtros', () => {
    const efetivo = [
      animal('b', { especie: 'Bovino', terrenoId: 't1' }),
      animal('o', { especie: 'Ovino', terrenoId: 't2' }),
      animal('solto', { especie: 'Ovino' }),
    ];
    expect(facetas(efetivo, { especie: 'Bovino' }).terrenoIds).toEqual(['t1']);
    expect(facetas(efetivo, { especie: 'Ovino' }).terrenoIds.sort()).toEqual([
      SEM_TERRENO,
      't2',
    ]);
  });

  it('só oferece categorias de alerta dos animais que restam', () => {
    const efetivo = [
      animal('b', { especie: 'Bovino' }),
      animal('o', { especie: 'Ovino' }),
    ];
    const m = mapaAlertas([
      { id: 'x1', animalId: 'b', categoria: 'identificacao', gravidade: 'urgente', titulo: '', descricao: '' },
      { id: 'x2', animalId: 'o', categoria: 'vacinacao', gravidade: 'info', titulo: '', descricao: '' },
    ]);
    expect(facetas(efetivo, {}, m).categoriasAlerta).toEqual(['identificacao', 'vacinacao']);
    expect(facetas(efetivo, { especie: 'Bovino' }, m).categoriasAlerta).toEqual(['identificacao']);
  });

  it('"sem brinco" some quando está tudo identificado', () => {
    const comBrinco = [animal('a', { numeroIdentificacao: 'PT1' })];
    const semBrinco = [animal('a', {})];
    expect(facetas(comBrinco).semBrinco).toBe(false);
    expect(facetas(semBrinco).semBrinco).toBe(true);
  });

  it('a pesquisa por texto também encolhe as opções', () => {
    const efetivo = [
      animal('a1', { nome: 'Mimosa', raca: 'Mertolenga' }),
      animal('a2', { nome: 'Estrela', raca: 'Minhota' }),
    ];
    expect(facetas(efetivo, { texto: 'mimo' }).racas).toEqual(['Mertolenga']);
  });
});
