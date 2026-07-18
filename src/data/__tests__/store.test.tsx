/**
 * Testes do store — a camada onde a app decide o que mostrar e o que enviar.
 *
 * Porquê aqui: é o único sítio onde um erro perde trabalho do criador sem dar
 * sinal. Uma escrita otimista que não chega à fila desaparece quando a app
 * fecha; uma cascata mal feita deixa eventos órfãos de animais eliminados; um
 * erro de rede tratado como erro lógico descarta o registo para sempre. Nada
 * disto rebenta à vista — a app continua bonita e o dado já não existe.
 *
 * O provider é exercitado a sério (com React), só com as fronteiras
 * simuladas: servidor, armazenamento e notificações.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Animal, Evento, Exploracao, Terreno } from '../types';

/* ---- Fronteiras simuladas ---- */

const mockMapa = new Map<string, string>();

jest.mock('../armazenamento', () => ({
  armazenamentoDisponivel: true,
  ler: (chave: string) => mockMapa.get(chave) ?? null,
  guardar: (chave: string, valor: string) => void mockMapa.set(chave, valor),
  remover: (chave: string) => void mockMapa.delete(chave),
}));

// Com sessão iniciada e Supabase configurado, o store segue o caminho
// offline-first (cache + fila) — que é precisamente o que interessa testar.
jest.mock('../supabase', () => ({ supabaseConfigurado: true, supabase: {} }));

jest.mock('../auth', () => ({
  useAuth: () => ({
    sessao: { user: { id: 'u-1', email: 'criador@exemplo.pt', user_metadata: { nome: 'Criador' } } },
    aCarregar: false,
    emRecuperacao: false,
  }),
}));

// Notificações do sistema não têm lugar num teste de lógica de dados.
jest.mock('../notificacoesLocais', () => ({
  suportaNotificacoes: false,
  temPermissao: async () => false,
  pedirPermissao: async () => false,
  agendar: async () => 0,
  cancelarTudo: async () => undefined,
}));

/**
 * Servidor simulado. `erroSeguinte` obriga a próxima escrita a falhar, para
 * distinguir os dois desfechos que importam: falha de rede (vai para a fila) e
 * erro lógico (rebenta à vista do criador).
 */
const mockServidor = {
  snapshot: {
    exploracoes: [] as Exploracao[],
    terrenos: [] as Terreno[],
    animais: [] as Animal[],
    eventos: [] as Evento[],
  },
  erroSeguinte: null as string | null,
  recebidas: [] as string[],
  falhasCarregar: 0,
};

function mockRespostaEscrita(etiqueta: string): string | null {
  if (mockServidor.erroSeguinte) {
    const erro = mockServidor.erroSeguinte;
    mockServidor.erroSeguinte = null;
    return erro;
  }
  mockServidor.recebidas.push(etiqueta);
  return null;
}

jest.mock('../supabaseRepo', () => ({
  carregarTudoSupabase: async () => {
    if (mockServidor.falhasCarregar > 0) {
      mockServidor.falhasCarregar -= 1;
      throw new Error('Network request failed');
    }
    return mockServidor.snapshot;
  },
  upsertAnimalSupabase: async (a: Animal) => mockRespostaEscrita(`upsert:animal:${a.id}`),
  upsertEventoSupabase: async (e: Evento) => mockRespostaEscrita(`upsert:evento:${e.id}`),
  upsertExploracaoSupabase: async (e: Exploracao) => mockRespostaEscrita(`upsert:exploracao:${e.id}`),
  upsertTerrenoSupabase: async (t: Terreno) => mockRespostaEscrita(`upsert:terreno:${t.id}`),
  eliminarAnimalSupabase: async (id: string) => mockRespostaEscrita(`delete:animal:${id}`),
  eliminarExploracaoSupabase: async (id: string) => mockRespostaEscrita(`delete:exploracao:${id}`),
  eliminarTerrenoSupabase: async (id: string) => mockRespostaEscrita(`delete:terreno:${id}`),
  // Classificação de erros: o store usa-as para separar conflito de recusa e
  // para limpar o marcador técnico antes de a mensagem chegar ao ecrã. Aqui
  // mantêm-se com o comportamento real, que é puro.
  ERRO_CONFLITO: 'CONFLITO_DE_VERSAO',
  eConflito: (msg: string) => msg.startsWith('CONFLITO_DE_VERSAO'),
  mensagemLegivel: (msg: string) =>
    msg.startsWith('CONFLITO_DE_VERSAO')
      ? msg.slice('CONFLITO_DE_VERSAO'.length).replace(/^:\s*/, '')
      : msg,
}));

import { lerOutbox } from '../cacheLocal';
import { NotificacoesProvider } from '../notificacoes';
import { GadoProvider, useGado } from '../store';

/* ---- Andaime ---- */

type Ctx = ReturnType<typeof useGado>;

function Sonda({ aoRender }: { aoRender: (c: Ctx) => void }) {
  aoRender(useGado());
  return null;
}

/** Monta o provider e devolve um acessor sempre com o contexto mais recente. */
async function montar(): Promise<{ ctx: () => Ctx; arvore: ReactTestRenderer }> {
  let atual: Ctx | null = null;
  let arvore!: ReactTestRenderer;
  await act(async () => {
    arvore = create(
      <NotificacoesProvider>
        <GadoProvider>
          <Sonda aoRender={(c) => (atual = c)} />
        </GadoProvider>
      </NotificacoesProvider>,
    );
  });
  return { ctx: () => atual as Ctx, arvore };
}

function animal(id: string, patch: Partial<Animal> = {}): Animal {
  return {
    id,
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: new Date(Date.now() - 900 * 86_400_000).toISOString(),
    numeroIdentificacao: `PT${id}`,
    ...patch,
  };
}

const exploracao: Exploracao = {
  id: 'exp-1',
  utilizadorId: 'u-1',
  nome: 'Herdade do Vale',
  marcaExploracao: 'PT001',
  nifDetentor: '500000000',
};

beforeEach(() => {
  mockMapa.clear();
  mockServidor.snapshot = { exploracoes: [], terrenos: [], animais: [], eventos: [] };
  mockServidor.erroSeguinte = null;
  mockServidor.recebidas = [];
  mockServidor.falhasCarregar = 0;
});

/* ---- Testes ---- */

describe('arranque', () => {
  it('puxa o efetivo do servidor quando há rede', async () => {
    mockServidor.snapshot = {
      exploracoes: [exploracao],
      terrenos: [],
      animais: [animal('a1')],
      eventos: [],
    };

    const { ctx } = await montar();

    expect(ctx().animais.map((a) => a.id)).toEqual(['a1']);
    expect(ctx().online).toBe(true);
  });

  it('sem rede, arranca com a cache e fica offline', async () => {
    // A cache é o que o criador viu da última vez. Sem ela, abrir a app no
    // mato mostrava um efetivo vazio — como se tivesse perdido os animais.
    mockMapa.set(
      'gado.cache.v1',
      JSON.stringify({ exploracoes: [exploracao], terrenos: [], animais: [animal('a9')], eventos: [] }),
    );
    mockServidor.falhasCarregar = 1;

    const { ctx } = await montar();

    expect(ctx().animais.map((a) => a.id)).toEqual(['a9']);
  });
});

describe('escritas otimistas', () => {
  it('mostra o animal imediatamente e envia ao servidor', async () => {
    const { ctx } = await montar();

    await act(async () => {
      await ctx().addAnimal({ ...animal('ignorado'), id: undefined } as unknown as Omit<Animal, 'id'>);
    });

    expect(ctx().animais).toHaveLength(1);
    expect(mockServidor.recebidas).toHaveLength(1);
    expect(lerOutbox()).toEqual([]); // enviado, nada pendente
  });

  it('sem rede, o animal aparece na mesma e a alteração fica na fila', async () => {
    // Este é o coração da promessa "funciona sem internet": o criador regista
    // o bezerro no monte e a app não pode dizer-lhe que não deu.
    const { ctx } = await montar();
    mockServidor.erroSeguinte = 'Network request failed';

    await act(async () => {
      await ctx().addAnimal(animal('novo') as Omit<Animal, 'id'>);
    });

    expect(ctx().animais).toHaveLength(1);
    expect(ctx().online).toBe(false);
    expect(ctx().pendentesSinc).toBe(1);
    expect(lerOutbox()).toHaveLength(1);
  });

  it('um erro do servidor rebenta à vista, em vez de ficar escondido na fila', async () => {
    // Sem permissão para esta exploração, repetir não adianta: o criador tem
    // de saber já, senão fica a pensar que gravou.
    const { ctx } = await montar();
    mockServidor.erroSeguinte = 'new row violates row-level security policy';

    await expect(
      act(async () => {
        await ctx().addAnimal(animal('recusado') as Omit<Animal, 'id'>);
      }),
    ).rejects.toThrow(/row-level security/);

    expect(lerOutbox()).toEqual([]);
  });

  it('guarda a cache local a cada alteração, para reabrir offline', async () => {
    const { ctx } = await montar();

    await act(async () => {
      await ctx().addAnimal(animal('a1') as Omit<Animal, 'id'>);
    });

    const cache = JSON.parse(mockMapa.get('gado.cache.v1') as string);
    expect(cache.animais).toHaveLength(1);
  });
});

describe('sincronização da fila', () => {
  it('esvazia a fila por ordem quando a rede volta', async () => {
    const { ctx } = await montar();

    mockServidor.erroSeguinte = 'Network request failed';
    await act(async () => {
      await ctx().addAnimal(animal('a1') as Omit<Animal, 'id'>);
    });
    mockServidor.erroSeguinte = 'Network request failed';
    await act(async () => {
      await ctx().addAnimal(animal('a2') as Omit<Animal, 'id'>);
    });
    expect(ctx().pendentesSinc).toBe(2);

    await act(async () => {
      await ctx().recarregar();
    });

    expect(ctx().pendentesSinc).toBe(0);
    expect(ctx().online).toBe(true);
    expect(lerOutbox()).toEqual([]);
    expect(mockServidor.recebidas).toHaveLength(2);
  });

  it('uma operação impossível não bloqueia as que vêm atrás', async () => {
    // A fila é sequencial: se a primeira operação nunca puder passar, todas as
    // outras ficam retidas indefinidamente. Descartá-la é o menor dos males.
    const { ctx } = await montar();

    mockServidor.erroSeguinte = 'Network request failed';
    await act(async () => {
      await ctx().addAnimal(animal('mau') as Omit<Animal, 'id'>);
    });
    mockServidor.erroSeguinte = 'Network request failed';
    await act(async () => {
      await ctx().addAnimal(animal('bom') as Omit<Animal, 'id'>);
    });

    mockServidor.erroSeguinte = 'invalid input syntax for type uuid';
    await act(async () => {
      await ctx().recarregar();
    });

    expect(ctx().pendentesSinc).toBe(0);
    expect(mockServidor.recebidas).toHaveLength(1); // só a segunda passou
  });

  it('a operação descartada fica registada, não desaparece', async () => {
    // Descartar é preciso para a fila não encravar, mas a alteração já tinha
    // sido mostrada ao criador como gravada. Sumir sem uma palavra foi o que
    // fez um veterinário perder registos feitos no mato.
    const { ctx } = await montar();

    mockServidor.erroSeguinte = 'Network request failed';
    await act(async () => {
      await ctx().addAnimal(animal('perdido') as Omit<Animal, 'id'>);
    });

    mockServidor.erroSeguinte = 'new row violates row-level security policy';
    await act(async () => {
      await ctx().recarregar();
    });

    expect(ctx().falhadas).toHaveLength(1);
    expect(ctx().falhadas[0].motivo).toBe('recusada');
    expect(ctx().falhadas[0].erro).toContain('row-level security');
  });

  it('distingue um conflito de versão de uma recusa por permissão', async () => {
    // As duas saem da fila da mesma maneira, mas dizem coisas opostas ao
    // criador: uma é "não podes", a outra é "outra pessoa chegou primeiro".
    const { ctx } = await montar();

    mockServidor.erroSeguinte = 'Network request failed';
    await act(async () => {
      await ctx().addAnimal(animal('colidido') as Omit<Animal, 'id'>);
    });

    mockServidor.erroSeguinte =
      'CONFLITO_DE_VERSAO: outra pessoa alterou este registo enquanto esteve sem ligação.';
    await act(async () => {
      await ctx().recarregar();
    });

    expect(ctx().falhadas).toHaveLength(1);
    expect(ctx().falhadas[0].motivo).toBe('conflito');
  });

  it('uma eliminação recusada repõe o animal e o seu histórico', async () => {
    // O servidor recusa eliminar animais com histórico. Sem reposição, o
    // animal desaparecia do ecrã à mesma e só voltava na sincronização
    // seguinte — o criador via-o sumir e depois ressuscitar.
    mockServidor.snapshot = {
      exploracoes: [exploracao],
      terrenos: [],
      animais: [animal('a1')],
      eventos: [
        { id: 'e1', animalId: 'a1', tipo: 'Pesagem', data: '2026-01-01', descricao: '' },
      ],
    };
    const { ctx } = await montar();
    expect(ctx().animais).toHaveLength(1);

    mockServidor.erroSeguinte = 'Este animal tem 1 registo(s) no histórico.';
    await expect(
      act(async () => {
        await ctx().deleteAnimal('a1');
      }),
    ).rejects.toThrow(/histórico/);

    expect(ctx().animais.map((a) => a.id)).toEqual(['a1']);
    expect(ctx().eventos.map((e) => e.id)).toEqual(['e1']);
  });

  it('limpar a lista de falhadas esvazia-a', async () => {
    const { ctx } = await montar();

    mockServidor.erroSeguinte = 'Network request failed';
    await act(async () => {
      await ctx().addAnimal(animal('x') as Omit<Animal, 'id'>);
    });
    mockServidor.erroSeguinte = 'invalid input syntax for type uuid';
    await act(async () => {
      await ctx().recarregar();
    });
    expect(ctx().falhadas).toHaveLength(1);

    await act(async () => {
      ctx().limparFalhadas();
    });

    expect(ctx().falhadas).toEqual([]);
  });
});

describe('cascatas locais', () => {
  it('eliminar uma exploração leva os seus terrenos, animais e eventos', async () => {
    // A cascata tem de acontecer já e offline: esperar pelo mockServidor deixaria
    // o ecrã a mostrar animais de uma exploração que já não existe.
    mockServidor.snapshot = {
      exploracoes: [exploracao, { ...exploracao, id: 'exp-2', nome: 'Outra' }],
      terrenos: [{ id: 't1', exploracaoId: 'exp-1', nome: 'Courela', tipo: 'Pastagem' }],
      animais: [animal('a1'), animal('a2', { exploracaoId: 'exp-2' })],
      eventos: [
        { id: 'e1', animalId: 'a1', tipo: 'Pesagem', data: new Date().toISOString(), descricao: '' },
        { id: 'e2', animalId: 'a2', tipo: 'Pesagem', data: new Date().toISOString(), descricao: '' },
      ],
    };
    const { ctx } = await montar();

    mockServidor.erroSeguinte = 'Network request failed'; // offline: só cascata local
    await act(async () => {
      await ctx().deleteExploracao('exp-1');
    });

    expect(ctx().exploracoes.map((e) => e.id)).toEqual(['exp-2']);
    expect(ctx().terrenos).toEqual([]);
    expect(ctx().animais.map((a) => a.id)).toEqual(['a2']);
    expect(ctx().eventos.map((e) => e.id)).toEqual(['e2']); // o do animal apagado saiu
  });

  it('eliminar um terreno solta os animais em vez de os apagar', async () => {
    mockServidor.snapshot = {
      exploracoes: [exploracao],
      terrenos: [{ id: 't1', exploracaoId: 'exp-1', nome: 'Courela', tipo: 'Pastagem' }],
      animais: [animal('a1', { terrenoId: 't1' })],
      eventos: [],
    };
    const { ctx } = await montar();

    await act(async () => {
      await ctx().deleteTerreno('t1');
    });

    expect(ctx().animais).toHaveLength(1);
    expect(ctx().animais[0].terrenoId).toBeUndefined();
  });
});

describe('saída do efetivo', () => {
  beforeEach(() => {
    mockServidor.snapshot = {
      exploracoes: [exploracao],
      terrenos: [],
      animais: [animal('a1', { terrenoId: 't1' })],
      eventos: [],
    };
  });

  it('uma venda regista o preço e liberta o terreno', async () => {
    const { ctx } = await montar();

    await act(async () => {
      await ctx().marcarSaida('a1', 'vendido', new Date().toISOString(), 'Feira', 850);
    });

    const a = ctx().animalById('a1')!;
    expect(a.estado).toBe('vendido');
    expect(a.terrenoId).toBeUndefined();

    const evento = ctx().eventosByAnimal('a1')[0];
    expect(evento.tipo).toBe('Venda');
    expect(evento.valor).toBe(850);
  });

  it('uma morte não regista valor nenhum', async () => {
    // Uma morte não é receita — se entrasse no balanço, as contas do criador
    // ficavam erradas a favor dele.
    const { ctx } = await montar();

    await act(async () => {
      await ctx().marcarSaida('a1', 'falecido', new Date().toISOString(), 'Doença', 500);
    });

    const evento = ctx().eventosByAnimal('a1')[0];
    expect(evento.tipo).toBe('Morte');
    expect(evento.valor).toBeUndefined();
  });

  it('quem saiu deixa de contar no efetivo e de gerar alertas', async () => {
    const { ctx } = await montar();

    await act(async () => {
      await ctx().marcarSaida('a1', 'vendido', new Date().toISOString());
    });

    expect(ctx().animaisByExploracao('exp-1')).toEqual([]);
    expect(ctx().animaisByExploracaoIncluindoSaidos('exp-1')).toHaveLength(1);
    expect(ctx().alertas.filter((al) => al.animalId === 'a1')).toEqual([]);
  });
});

describe('alertas dispensados', () => {
  beforeEach(() => {
    // Adulto sem vacinação registada → alerta informativo permanente, que é
    // exatamente o que se quer poder calar.
    mockServidor.snapshot = {
      exploracoes: [exploracao],
      terrenos: [],
      animais: [animal('a1')],
      eventos: [],
    };
  });

  it('dispensar tira o alerta da lista e guarda a decisão', async () => {
    const { ctx } = await montar();

    const vacinacao = ctx().alertas.find((a) => a.categoria === 'vacinacao');
    expect(vacinacao).toBeDefined();

    await act(async () => {
      ctx().dispensarAlerta(vacinacao!);
    });

    expect(ctx().alertas.find((a) => a.id === vacinacao!.id)).toBeUndefined();
    expect(ctx().alertasDispensados.map((a) => a.id)).toEqual([vacinacao!.id]);
    expect(mockMapa.get('gado.alertas-dispensados.v1')).toContain(vacinacao!.id);
  });

  it('repor volta a mostrar o alerta', async () => {
    const { ctx } = await montar();
    const vacinacao = ctx().alertas.find((a) => a.categoria === 'vacinacao')!;

    await act(async () => {
      ctx().dispensarAlerta(vacinacao);
    });
    await act(async () => {
      ctx().reativarAlerta(vacinacao.id);
    });

    expect(ctx().alertas.find((a) => a.id === vacinacao.id)).toBeDefined();
  });

  it('a decisão sobrevive a reabrir a app', async () => {
    const primeira = await montar();
    const vacinacao = primeira.ctx().alertas.find((a) => a.categoria === 'vacinacao')!;
    await act(async () => {
      primeira.ctx().dispensarAlerta(vacinacao);
    });
    await act(async () => {
      primeira.arvore.unmount();
    });

    const segunda = await montar();

    expect(segunda.ctx().alertas.find((a) => a.id === vacinacao.id)).toBeUndefined();
  });
});
