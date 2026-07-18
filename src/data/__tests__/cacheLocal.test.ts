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
  descreverOp,
  guardarAcesso,
  lerAcesso,
  guardarCache,
  guardarOutbox,
  lerCache,
  lerFalhadas,
  lerOutbox,
  limparCache,
  limparFalhadas,
  pareceErroDeRede,
  registarFalhada,
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
    movimentos: [],
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
  it('apaga os dados, a fila e as recusas da conta que saiu', () => {
    // Sem isto, o criador seguinte a entrar neste aparelho via o efetivo do
    // anterior enquanto o servidor não respondesse.
    guardarCache({
      exploracoes: [],
      terrenos: [],
      animais: [animal('a1')],
      eventos: [],
      movimentos: [],
    });
    adicionarOutbox(upsert('a1'));
    registarFalhada(upsert('a1'), 'permission denied');

    limparCache();

    expect(lerCache()).toBeNull();
    expect(lerOutbox()).toEqual([]);
    expect(lerFalhadas()).toEqual([]);
  });
});

describe('acesso — quem sou e onde pertenço, para a app abrir sem rede', () => {
  // Sem isto, arrancar offline dava `membros: []` e `estadoPerfil: 'pendente'`,
  // e o portão da app mandava o criador para o ecrã de "aguarda aprovação" em
  // vez da sua exploração. A promessa de funcionar sem internet caía antes
  // sequer de se chegar à cache dos dados.
  it('devolve null enquanto nunca houve resposta do servidor', () => {
    expect(lerAcesso()).toBeNull();
  });

  it('faz ida e volta sem perder nada', () => {
    const acesso = {
      estadoPerfil: 'ativo' as const,
      isSuperadmin: false,
      membros: [{ id: 'm1', userId: 'u1', exploracaoId: 'exp-1', role: 'admin' }],
    };
    guardarAcesso(acesso);
    expect(lerAcesso()).toEqual(acesso);
  });

  it('trata lixo como "não sei", em vez de inventar um estado', () => {
    // Afirmar 'ativo' ou 'superadmin' a partir de dados corrompidos seria
    // conceder acesso por acidente.
    mockMapa.set('gado.acesso.v1', 'não é json');
    expect(lerAcesso()).toBeNull();
  });

  it('recusa um estado de perfil que não reconhece', () => {
    mockMapa.set('gado.acesso.v1', JSON.stringify({ estadoPerfil: 'deus', isSuperadmin: true }));
    expect(lerAcesso()).toBeNull();
  });

  it('aguenta membros em falta ou com forma errada', () => {
    mockMapa.set(
      'gado.acesso.v1',
      JSON.stringify({ estadoPerfil: 'ativo', isSuperadmin: false, membros: 'nada disto' }),
    );
    expect(lerAcesso()?.membros).toEqual([]);
  });

  it('sai do dispositivo quando a sessão termina', () => {
    // Senão o próximo a entrar herdava os papéis do anterior durante o arranque.
    guardarAcesso({ estadoPerfil: 'ativo', isSuperadmin: true, membros: [] });
    limparCache();
    expect(lerAcesso()).toBeNull();
  });
});

describe('falhadas — escritas que o servidor recusou', () => {
  // Antes, uma escrita recusada era descartada em silêncio: a alteração já
  // tinha aparecido ao criador como gravada e desaparecia sem uma palavra.
  // Um veterinário podia perder meia hora de registos feitos no mato.
  it('começa vazia', () => {
    expect(lerFalhadas()).toEqual([]);
  });

  it('guarda a operação, o erro do servidor e o momento', () => {
    registarFalhada(upsert('a1'), 'new row violates row-level security policy');

    const [f] = lerFalhadas();
    expect(f.op).toEqual(upsert('a1'));
    expect(f.erro).toContain('row-level security');
    expect(Number.isNaN(Date.parse(f.em))).toBe(false);
  });

  it('mostra a mais recente primeiro', () => {
    registarFalhada(upsert('antiga'), 'erro 1');
    registarFalhada(upsert('nova'), 'erro 2');

    const ids = lerFalhadas().map((f) => (f.op.op === 'upsert' ? f.op.dados.id : f.op.id));
    expect(ids).toEqual(['nova', 'antiga']);
  });

  it('não cresce sem fim — é um registo para ler, não um arquivo', () => {
    for (let i = 0; i < 60; i++) registarFalhada(upsert(`a${i}`), 'erro');
    expect(lerFalhadas()).toHaveLength(50);
  });

  it('esquece a lista quando o criador a dispensa', () => {
    registarFalhada(upsert('a1'), 'erro');
    limparFalhadas();
    expect(lerFalhadas()).toEqual([]);
  });

  it('não rebenta com um valor corrompido', () => {
    mockMapa.set('gado.falhadas.v1', 'lixo');
    expect(lerFalhadas()).toEqual([]);
  });
});

describe('descreverOp — o que a alteração recusada tentava fazer', () => {
  it('identifica uma gravação pelo nome', () => {
    const op: OpPendente = {
      op: 'upsert',
      entidade: 'terreno',
      dados: { id: 't1', exploracaoId: 'exp-1', nome: 'Courela do Vale' },
    };
    expect(descreverOp(op)).toBe('Terreno: Courela do Vale');
  });

  it('identifica um evento pelo tipo, que é o que ele tem em vez de nome', () => {
    const op: OpPendente = {
      op: 'upsert',
      entidade: 'evento',
      dados: { id: 'e1', animalId: 'a1', tipo: 'Vacinação', data: '2026-07-18', descricao: '' },
    };
    expect(descreverOp(op)).toBe('Evento: Vacinação');
  });

  it('descreve uma eliminação sem depender de dados', () => {
    expect(descreverOp({ op: 'delete', entidade: 'animal', id: 'a1' })).toBe('Eliminar animal');
  });

  it('aguenta uma entidade sem nome', () => {
    expect(descreverOp(upsert('a1'))).toBe('Gravar animal');
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

  // Classificar como lógico => a operação sai da fila (repeti-la falharia
  // sempre e bloquearia tudo atrás dela), mas fica registada nas falhadas.
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

  it('ARMADILHA: uma mensagem de conflito pode falar de "ligação" e enganá-la', () => {
    // Esta heurística pesca por palavras, e o texto natural de um conflito
    // ("outra pessoa alterou isto enquanto esteve sem ligação") cai na rede.
    // Aconteceu mesmo, e o efeito era mau: o conflito voltava à fila e ficava
    // a repetir-se para sempre, porque a versão do servidor nunca recuaria.
    expect(pareceErroDeRede('outra pessoa alterou isto enquanto esteve sem ligação')).toBe(true);

    // Por isso o store verifica `eConflito()` ANTES de chamar esta função, e a
    // mensagem real evita as palavras-armadilha. Se alguém reescrever o texto
    // do conflito, este teste lembra porquê.
    expect(
      pareceErroDeRede(
        'CONFLITO_DE_VERSAO: outra pessoa alterou este registo antes de esta alteração chegar ao servidor.',
      ),
    ).toBe(false);
  });
});
