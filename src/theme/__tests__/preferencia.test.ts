/**
 * A paleta que viaja na conta.
 *
 * Porquê: a escolha de cor deixou de ser do aparelho e passou a ser da conta,
 * para quem a muda no telemóvel a encontrar igual no computador. O risco desta
 * troca não é a cor errada — é o CICLO: dois aparelhos a corrigirem-se um ao
 * outro, cada correção a recarregar a app. É isso que estes testes prendem.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockMapa = new Map<string, string>();

jest.mock('@/data/armazenamento', () => ({
  armazenamentoDisponivel: true,
  ler: (chave: string) => mockMapa.get(chave) ?? null,
  guardar: (chave: string, valor: string) => void mockMapa.set(chave, valor),
  remover: (chave: string) => void mockMapa.delete(chave),
}));

// A conta, com sessão iniciada e a aceitar a gravação.
//
// As funções do mock são chamadas por DENTRO de uma seta, e não passadas
// diretamente: a fábrica do `jest.mock` é avaliada quando o módulo é pedido
// pela primeira vez — antes destas constantes existirem — e passá-las
// diretamente guardava `undefined`. O `auth.getSession()` rebentava, o erro era
// engolido pelo `try` do `guardarNaConta`, e o teste via zero chamadas sem
// nenhum sinal de que a culpa era do próprio teste.
const mockUpdateUser = jest.fn(async (_dados: unknown) => ({ error: null }));
const mockGetSession = jest.fn(async () => ({ data: { session: { user: {} } } }));
jest.mock('@/data/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      updateUser: (dados: unknown) => mockUpdateUser(dados),
    },
  },
  supabaseConfigurado: true,
}));

// Recarregar a app não se faz num teste; o que interessa é o que ficou gravado.
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn(async () => undefined) }));

import {
  mudarPaleta,
  paletaDaConta,
  paletaGuardada,
  seguirPaletaDaConta,
} from '../preferencia';

beforeEach(() => {
  mockMapa.clear();
  mockUpdateUser.mockClear();
  mockGetSession.mockClear();
});

describe('paletaDaConta', () => {
  it('lê a escolha que a conta traz', () => {
    expect(paletaDaConta({ nome: 'Joaquim', paleta: 'noite', paletaEm: 1700 })).toEqual({
      id: 'noite',
      em: 1700,
    });
  });

  it('aceita uma escolha sem hora (gravada por uma versão anterior)', () => {
    expect(paletaDaConta({ paleta: 'noite' })).toEqual({ id: 'noite', em: 0 });
  });

  it('ignora o que não é uma paleta desta app', () => {
    // Os metadados vêm de fora e podem ter lá dentro qualquer coisa: o id de
    // uma paleta retirada da app, um número, lixo. Devolver a paleta de origem
    // punha o aparelho a mudar de cor sozinho por causa de um valor inválido.
    expect(paletaDaConta({ paleta: 'paleta-que-nao-existe' })).toBeNull();
    expect(paletaDaConta({ paleta: 42 })).toBeNull();
    expect(paletaDaConta({})).toBeNull();
    expect(paletaDaConta(null)).toBeNull();
    expect(paletaDaConta('paleta')).toBeNull();
  });
});

describe('seguirPaletaDaConta', () => {
  it('adota a paleta da conta quando este aparelho ainda não a conhece', async () => {
    await seguirPaletaDaConta({ id: 'noite', em: 1000 });
    expect(paletaGuardada()).toBe('noite');
  });

  it('não mexe em nada quando a escolha da conta já é conhecida', async () => {
    await seguirPaletaDaConta({ id: 'noite', em: 1000 });
    // Alguém muda de ideias só neste aparelho (sem chegar à conta).
    mockMapa.set('tema.paleta', 'oliveira');

    await seguirPaletaDaConta({ id: 'noite', em: 1000 });

    expect(paletaGuardada()).toBe('oliveira');
  });

  it('não desfaz a escolha que este aparelho acabou de fazer', async () => {
    /**
     * O ciclo que isto prende: o computador muda para "noite" e grava-o na
     * conta; a sessão em memória ainda traz a escolha ANTERIOR e chega uma
     * leitura com ela. Comparada pelo VALOR, essa leitura era indistinguível de
     * outro aparelho ter mudado: a app desfazia a escolha do criador e
     * recarregava-se para isso — e do outro lado o telemóvel fazia o mesmo com
     * a mudança seguinte, cada um a recarregar a app do outro.
     */
    mockMapa.set('tema.paleta', 'campo');
    mockMapa.set('tema.paleta.em', '1000');

    await mudarPaleta('noite');
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { paleta: 'noite', paletaEm: expect.any(Number) },
    });

    // A sessão ainda traz a escolha antiga, com a hora antiga.
    await seguirPaletaDaConta({ id: 'campo', em: 1000 });

    expect(paletaGuardada()).toBe('noite');
  });

  it('segue uma escolha mais recente feita noutro aparelho', async () => {
    mockMapa.set('tema.paleta', 'campo');
    mockMapa.set('tema.paleta.em', '1000');

    await seguirPaletaDaConta({ id: 'noite', em: 2000 });

    expect(paletaGuardada()).toBe('noite');
  });
});
