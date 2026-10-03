/**
 * A leitura de tudo o que a conta vê (`carregarTudoSupabase`) tem de trazer as
 * tabelas INTEIRAS.
 *
 * O Supabase corta cada resposta no `max rows` da API (1000 por omissão) sem
 * dizer nada: a resposta vem com ar de completa. Foi assim que a conta com a
 * carga de teste em produção (4728 animais no efetivo) abriu a mostrar 952, e
 * com os alertas, o SNIRA e as finanças calculados a partir de um quinto dos
 * dados. Estes testes põem um servidor falso que corta como o verdadeiro.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Linha = Record<string, unknown> & { id: string };

/** O que o servidor falso tem em cada tabela, e onde corta. */
const mockServidor: {
  tabelas: Record<string, Linha[]>;
  maxRows: number;
  /** Uma tabela cuja página N (a contar de 0) responde com erro. */
  falhaNaPagina?: { tabela: string; pagina: number };
  /** Linhas inseridas no início da tabela depois da primeira página. */
  inserirDepoisDaPrimeira?: { tabela: string; linhas: Linha[] };
  pedidos: { tabela: string; de: number; ate: number; contar: boolean; ordem: string[] }[];
} = { tabelas: {}, maxRows: 1000, pedidos: [] };

jest.mock('../supabase', () => {
  const construir = (tabela: string) => {
    let contar = false;
    const ordem: string[] = [];
    const cadeia = {
      select(_colunas: string, opcoes?: { count?: string }) {
        contar = opcoes?.count === 'exact';
        return cadeia;
      },
      order(coluna: string, opcoes?: { ascending?: boolean }) {
        ordem.push(`${coluna}${opcoes?.ascending === false ? ' desc' : ''}`);
        return cadeia;
      },
      range(de: number, ate: number) {
        const n = mockServidor.pedidos.filter((p) => p.tabela === tabela).length;
        mockServidor.pedidos.push({ tabela, de, ate, contar, ordem: [...ordem] });
        if (mockServidor.falhaNaPagina?.tabela === tabela && mockServidor.falhaNaPagina.pagina === n) {
          return Promise.resolve({ data: null, error: { message: 'Failed to fetch' }, count: null });
        }
        const todas = mockServidor.tabelas[tabela] ?? [];
        const fatia = todas.slice(de, Math.min(ate + 1, de + mockServidor.maxRows));
        const resposta = { data: fatia, error: null, count: contar ? todas.length : null };
        const inserir = mockServidor.inserirDepoisDaPrimeira;
        if (inserir?.tabela === tabela && n === 0) {
          mockServidor.tabelas[tabela] = [...inserir.linhas, ...todas];
        }
        return Promise.resolve(resposta);
      },
    };
    return cadeia;
  };
  return { supabase: { from: construir }, supabaseConfigurado: true };
});

import { carregarTudoSupabase, LINHAS_POR_PAGINA } from '../supabaseRepo';

function animais(n: number, prefixo = 'an'): Linha[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefixo}-${String(i).padStart(5, '0')}`,
    exploracao_id: 'exp-1',
    nome: `Animal ${i}`,
    especie: 'Bovino',
    sexo: 'Fêmea',
    data_nascimento: '2021-08-25',
    estado: 'ativo',
  }));
}

function eventos(n: number): Linha[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `ev-${String(i).padStart(5, '0')}`,
    animal_id: `an-${String(i % 50).padStart(5, '0')}`,
    tipo: 'Vacinação',
    data: '2026-05-01',
    descricao: 'Vacina',
  }));
}

beforeEach(() => {
  mockServidor.tabelas = {};
  mockServidor.maxRows = 1000;
  mockServidor.falhaNaPagina = undefined;
  mockServidor.inserirDepoisDaPrimeira = undefined;
  mockServidor.pedidos = [];
});

describe('carregarTudoSupabase lê as tabelas inteiras', () => {
  it('traz os 4728 animais e os 9835 eventos, e não só os primeiros 1000', async () => {
    mockServidor.tabelas.animal = animais(4728);
    mockServidor.tabelas.evento = eventos(9835);
    const snap = await carregarTudoSupabase();
    expect(snap.animais).toHaveLength(4728);
    expect(snap.eventos).toHaveLength(9835);
    // Sem repetidos: cada id uma vez só.
    expect(new Set(snap.animais.map((a) => a.id)).size).toBe(4728);
  });

  it('pede a contagem só na primeira página e as seguintes em blocos do tamanho dela', async () => {
    mockServidor.tabelas.animal = animais(2500);
    await carregarTudoSupabase();
    const pedidos = mockServidor.pedidos.filter((p) => p.tabela === 'animal');
    expect(pedidos.map((p) => [p.de, p.ate, p.contar])).toEqual([
      [0, LINHAS_POR_PAGINA - 1, true],
      [1000, 1999, false],
      [2000, 2999, false],
    ]);
  });

  it('continua a ler quando o servidor corta MAIS cedo do que as 1000 pedidas', async () => {
    // Um projeto com o `max rows` a 500: todas as páginas vêm "incompletas".
    // Parar na primeira página incompleta era repetir o corte de antes.
    mockServidor.maxRows = 500;
    mockServidor.tabelas.animal = animais(1800);
    const snap = await carregarTudoSupabase();
    expect(snap.animais).toHaveLength(1800);
  });

  it('ordena sempre pelo id no fim, para nenhuma linha trocar de página', async () => {
    mockServidor.tabelas.evento = eventos(10);
    await carregarTudoSupabase();
    const ordens = Object.fromEntries(mockServidor.pedidos.map((p) => [p.tabela, p.ordem]));
    expect(ordens.evento).toEqual(['data desc', 'id']);
    expect(ordens.animal).toEqual(['id']);
    expect(ordens.exploracao).toEqual(['nome', 'id']);
  });

  it('não repete a linha que uma inserção a meio empurrou para a página seguinte', async () => {
    mockServidor.tabelas.animal = animais(1500);
    mockServidor.inserirDepoisDaPrimeira = { tabela: 'animal', linhas: animais(1, 'novo') };
    const snap = await carregarTudoSupabase();
    const ids = snap.animais.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uma página que falha derruba a leitura toda, em vez de devolver metade', async () => {
    // Metade dos dados com ar de completos é pior do que nenhuns: a cache
    // ficava com eles e o efetivo encolhia sem explicação.
    mockServidor.tabelas.animal = animais(2500);
    mockServidor.falhaNaPagina = { tabela: 'animal', pagina: 2 };
    await expect(carregarTudoSupabase()).rejects.toThrow();
  });

  it('uma tabela pequena continua a ser um pedido só', async () => {
    mockServidor.tabelas.animal = animais(12);
    await carregarTudoSupabase();
    expect(mockServidor.pedidos.filter((p) => p.tabela === 'animal')).toHaveLength(1);
  });
});
