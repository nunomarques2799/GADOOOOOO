import { describe, expect, it } from '@jest/globals';

import {
  contarHistorico,
  juntarHistorico,
  quantoEsteve,
  rotuloFim,
  type EntradaHistorico,
  type SaidaEquipa,
  type VinculoExpirado,
} from '../historicoEquipa';

/** Um formatador previsível: os testes não podem depender do fuso da máquina. */
const formatar = (iso: string) => iso.slice(0, 16).replace('T', ' ');

const nomes: Record<string, string> = { e1: 'Monte do Avô', e2: 'Herdade das Corgas' };
const nomeExploracao = (id: string) => nomes[id] ?? 'Exploração';

function saida(over: Partial<SaidaEquipa> = {}): SaidaEquipa {
  return {
    id: '1',
    exploracaoId: 'e1',
    userId: 'u1',
    nome: 'Zé Silva',
    role: 'trabalhador',
    entrouEm: '2026-01-10T09:00:00.000Z',
    saiuEm: '2026-03-10T09:00:00.000Z',
    motivo: 'removido',
    ...over,
  };
}

function expirado(over: Partial<VinculoExpirado> = {}): VinculoExpirado {
  return {
    membroId: 'm1',
    exploracaoId: 'e1',
    userId: 'u2',
    nome: 'Dr. Antunes',
    role: 'veterinario',
    criadoEm: '2026-08-05T08:00:00.000Z',
    expiraEm: '2026-08-05T12:54:00.000Z',
    ...over,
  };
}

describe('juntarHistorico', () => {
  it('junta as duas famílias do mais recente para trás', () => {
    const lista = juntarHistorico(
      [saida({ id: '1', saiuEm: '2026-03-10T09:00:00.000Z' })],
      [expirado({ membroId: 'm1', expiraEm: '2026-08-05T12:54:00.000Z' })],
      nomeExploracao,
    );
    expect(lista.map((e) => e.chave)).toEqual(['expirado:m1', 'saida:1']);
  });

  it('marca quem ainda tem vínculo como reabrível e quem saiu como não', () => {
    const [comVinculo, semVinculo] = juntarHistorico([saida()], [expirado()], nomeExploracao);
    expect(comVinculo.tipo).toBe('expirado');
    expect(comVinculo.membroId).toBe('m1');
    // É o que decide se o ecrã oferece reabrir ou manda gerar um código novo:
    // sem `membroId` não há vínculo nenhum a que dar mais tempo.
    expect(semVinculo.tipo).toBe('saiu');
    expect(semVinculo.membroId).toBeUndefined();
  });

  it('traz o nome da exploração de cada linha', () => {
    const lista = juntarHistorico(
      [saida({ exploracaoId: 'e2' })],
      [expirado({ exploracaoId: 'e1' })],
      nomeExploracao,
    );
    expect(lista.map((e) => e.nomeExploracao)).toEqual(['Monte do Avô', 'Herdade das Corgas']);
  });

  it('não perde as linhas de quem já não tem conta', () => {
    // `user_id` fica a nulo quando a conta é apagada, e o nome é substituído no
    // servidor. A linha continua a valer: o dono tem de conseguir ver que
    // naquele dia saiu alguém daquela exploração.
    const [linha] = juntarHistorico(
      [saida({ userId: undefined, nome: 'Conta apagada' })],
      [],
      nomeExploracao,
    );
    expect(linha.nome).toBe('Conta apagada');
    expect(linha.userId).toBeUndefined();
  });
});

describe('rotuloFim', () => {
  const entradaDe = (over: Partial<EntradaHistorico>): EntradaHistorico => ({
    chave: 'x',
    tipo: 'saiu',
    exploracaoId: 'e1',
    nomeExploracao: 'Monte do Avô',
    nome: 'Zé Silva',
    role: 'trabalhador',
    fimEm: '2026-03-10T09:00:00.000Z',
    ...over,
  });

  it('distingue as três maneiras de deixar de ter acesso', () => {
    expect(rotuloFim(entradaDe({ tipo: 'expirado' }), formatar)).toBe(
      'Acesso terminou a 2026-03-10 09:00',
    );
    expect(rotuloFim(entradaDe({ motivo: 'removido' }), formatar)).toBe(
      'Removido da equipa a 2026-03-10 09:00',
    );
    expect(rotuloFim(entradaDe({ motivo: 'saiu' }), formatar)).toBe(
      'Saiu da equipa a 2026-03-10 09:00',
    );
  });
});

describe('quantoEsteve', () => {
  const passagem = (entrouEm: string | undefined, fimEm: string): EntradaHistorico => ({
    chave: 'x',
    tipo: 'saiu',
    exploracaoId: 'e1',
    nomeExploracao: 'Monte do Avô',
    nome: 'Zé Silva',
    role: 'veterinario',
    entrouEm,
    fimEm,
  });

  it('conta a visita em horas, a campanha em dias e a época em meses', () => {
    expect(quantoEsteve(passagem('2026-08-05T08:00:00.000Z', '2026-08-05T12:00:00.000Z'))).toBe(
      'esteve 4 horas',
    );
    // Dois meses ainda se dizem em dias: quem esteve dois meses lembra-se dos
    // dias, e "2 meses" perdia a diferença entre uma campanha e a seguinte.
    expect(quantoEsteve(passagem('2026-01-10T09:00:00.000Z', '2026-03-10T09:00:00.000Z'))).toBe(
      'esteve 59 dias',
    );
    expect(quantoEsteve(passagem('2025-08-05T09:00:00.000Z', '2026-03-10T09:00:00.000Z'))).toBe(
      'esteve 7 meses',
    );
    expect(quantoEsteve(passagem('2023-03-10T09:00:00.000Z', '2026-03-10T09:00:00.000Z'))).toBe(
      'esteve 3 anos',
    );
  });

  it('cala-se quando não sabe, em vez de inventar um zero', () => {
    expect(quantoEsteve(passagem(undefined, '2026-03-10T09:00:00.000Z'))).toBeNull();
    expect(quantoEsteve(passagem('não é uma data', '2026-03-10T09:00:00.000Z'))).toBeNull();
    // Saída antes da entrada é engano de relógio, não uma passagem negativa.
    expect(quantoEsteve(passagem('2026-03-10T09:00:00.000Z', '2026-01-10T09:00:00.000Z'))).toBeNull();
  });
});

describe('contarHistorico', () => {
  it('conta cada família à parte (é o resumo do topo do ecrã)', () => {
    const lista = juntarHistorico(
      [saida({ id: '1' }), saida({ id: '2' })],
      [expirado()],
      nomeExploracao,
    );
    expect(contarHistorico(lista)).toEqual({ expirados: 1, saidos: 2 });
  });
});
