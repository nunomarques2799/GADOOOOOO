/**
 * Testes da camada offline-first: fila de sincronização (outbox), cache local e
 * a heurística que decide se uma gravação falhada volta a ser tentada.
 *
 * Porquê esta camada e não outra: é a única onde um erro APAGA trabalho do
 * criador. Se `pareceErroDeRede` classificar mal uma falha, a operação é
 * descartada em silêncio e o registo do animal desaparece — sem mensagem, sem
 * forma de o recuperar. O resto da app, quando falha, falha à vista.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// O armazenamento real é SQLite (nativo) ou localStorage (web). Aqui troca-se
// por um Map em memória, para os testes exercitarem a lógica do cacheLocal e
// não o motor de armazenamento. O prefixo `mock` é o que autoriza o jest a
// referenciar a variável dentro da fábrica (que é içada acima dos imports).
const mockMapa = new Map<string, string>();

jest.mock('../armazenamento', () => ({
  armazenamentoDisponivel: true,
  ler: (chave: string) => mockMapa.get(chave) ?? null,
  guardar: (chave: string, valor: string) => void mockMapa.set(chave, valor),
  remover: (chave: string) => void mockMapa.delete(chave),
}));

import {
  adicionarOutbox,
  guardarCache,
  guardarOutbox,
  lerCache,
  lerOutbox,
  limparCache,
  pareceErroDeRede,
  type OpPendente,
} from '../cacheLocal';
import type { Animal } from '../types';

function animal(id: string): Animal {
  return {
    id,
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: '2025-01-01',
  };
}

function upsert(id: string): OpPendente {
  return { op: 'upsert', entidade: 'animal', dados: animal(id) };
}

beforeEach(() => {
  mockMapa.clear();
});

describe('outbox — fila de alterações por enviar', () => {
  it('começa vazia', () => {
    expect(lerOutbox()).toEqual([]);
  });

  it('preserva a ordem de chegada', () => {
    // A ordem importa: criar um animal e só depois registar-lhe um evento não
    // pode ser enviado ao contrário, ou o servidor rejeita a chave estrangeira.
    adicionarOutbox(upsert('a1'));
    adicionarOutbox(upsert('a2'));
    adicionarOutbox(upsert('a3'));

    const ids = lerOutbox().map((o) => (o.op === 'upsert' ? o.dados.id : o.id));
    expect(ids).toEqual(['a1', 'a2', 'a3']);
  });

  it('devolve o total pendente a cada adição', () => {
    expect(adicionarOutbox(upsert('a1'))).toBe(1);
    expect(adicionarOutbox(upsert('a2'))).toBe(2);
  });

  it('sobrevive a reinícios da app (persiste no armazenamento)', () => {
    adicionarOutbox(upsert('a1'));
    // `lerOutbox` volta a ler do armazenamento, não de memória do módulo.
    expect(lerOutbox()).toHaveLength(1);
  });

  it('guarda operações de eliminação tal como as de gravação', () => {
    adicionarOutbox({ op: 'delete', entidade: 'terreno', id: 't9' });
    expect(lerOutbox()).toEqual([{ op: 'delete', entidade: 'terreno', id: 't9' }]);
  });

  it('não rebenta com um valor corrompido no armazenamento', () => {
    // Se isto lançasse, o arranque da app morria e o criador ficava sem entrar.
    mockMapa.set('gado.outbox.v1', '{isto não é json}');
    expect(lerOutbox()).toEqual([]);
  });

  it('devolve lista vazia se o valor guardado não for um array', () => {
    // O store faz `while (ops.length > 0)` e itera — um objeto aqui seria um
    // ciclo infinito ou um crash no arranque.
    mockMapa.set('gado.outbox.v1', '{"op":"upsert"}');
    expect(lerOutbox()).toEqual([]);
  });
});

describe('cache local — dados visíveis sem rede', () => {
  const dados = {
    exploracoes: [],
    terrenos: [],
    animais: [animal('a1')],
    eventos: [],
  };

  it('devolve null enquanto não houver nada guardado', () => {
    expect(lerCache()).toBeNull();
  });

  it('faz ida e volta sem perder os dados', () => {
    guardarCache(dados);
    expect(lerCache()).toEqual(dados);
  });

  it('não rebenta com cache corrompida — trata como se não existisse', () => {
    mockMapa.set('gado.cache.v1', 'lixo');
    expect(lerCache()).toBeNull();
  });
});

describe('limparCache — ao terminar sessão', () => {
  it('apaga os dados e a fila da conta que saiu', () => {
    // Sem isto, o criador seguinte a entrar neste aparelho via o efetivo do
    // anterior enquanto o servidor não respondesse.
    guardarCache({ exploracoes: [], terrenos: [], animais: [animal('a1')], eventos: [] });
    adicionarOutbox(upsert('a1'));

    limparCache();

    expect(lerCache()).toBeNull();
    expect(lerOutbox()).toEqual([]);
  });
});

describe('pareceErroDeRede — decide entre reenviar e descartar', () => {
  // Classificar como rede => a operação fica na fila e é reenviada.
  it.each([
    'TypeError: Failed to fetch',
    'Network request failed',
    'The request timed out',
    'Could not establish connection',
    'Sem ligação à internet',
    'Aborted',
  ])('trata %j como falha de rede (reenvia mais tarde)', (msg) => {
    expect(pareceErroDeRede(msg)).toBe(true);
  });

  // Classificar como lógico => a operação é descartada, e ainda bem: repeti-la
  // falharia sempre e bloquearia a fila toda atrás dela.
  it.each([
    'new row violates row-level security policy for table "animal"',
    'duplicate key value violates unique constraint',
    'invalid input syntax for type uuid',
    'permission denied for table exploracao',
  ])('trata %j como erro do servidor (não reenvia)', (msg) => {
    expect(pareceErroDeRede(msg)).toBe(false);
  });

  it('é indiferente a maiúsculas', () => {
    expect(pareceErroDeRede('NETWORK REQUEST FAILED')).toBe(true);
  });
});
