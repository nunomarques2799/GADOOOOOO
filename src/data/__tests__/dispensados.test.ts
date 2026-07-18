/**
 * Testes das dispensas de alertas.
 *
 * Porquê: calar um aviso é fácil de acertar; o que é difícil é garantir que
 * ele VOLTA quando devia. Uma dispensa que sobrevive a um agravamento esconde
 * um prazo legal já vencido — e a app fica a garantir silêncio precisamente
 * quando devia estar a gritar.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockMapa = new Map<string, string>();

jest.mock('../armazenamento', () => ({
  armazenamentoDisponivel: true,
  ler: (chave: string) => mockMapa.get(chave) ?? null,
  guardar: (chave: string, valor: string) => void mockMapa.set(chave, valor),
  remover: (chave: string) => void mockMapa.delete(chave),
}));

import {
  dispensar,
  estaDispensado,
  filtrarDispensados,
  lerDispensas,
  limparObsoletas,
  podeDispensar,
  reporDispensa,
} from '../dispensados';
import type { Alerta } from '../types';

function alerta(patch: Partial<Alerta> = {}): Alerta {
  return {
    id: 'vac-a1',
    categoria: 'vacinacao',
    gravidade: 'info',
    titulo: 'Sem registo de vacinação',
    descricao: 'Mimosa não tem nenhuma vacinação registada.',
    animalId: 'a1',
    ...patch,
  };
}

beforeEach(() => mockMapa.clear());

describe('podeDispensar — o que se deixa calar', () => {
  it('deixa calar um aviso informativo sem prazo', () => {
    expect(podeDispensar(alerta())).toBe(true);
  });

  it('não deixa calar nada com contagem decrescente', () => {
    // Identificação, SNIRA, parto, intervalo de segurança: têm relógio a
    // andar e consequências legais. Silenciá-los seria dar um botão para o
    // criador se prejudicar a si próprio.
    expect(podeDispensar(alerta({ diasRestantes: 5 }))).toBe(false);
  });

  it('não deixa calar avisos e urgentes', () => {
    expect(podeDispensar(alerta({ gravidade: 'aviso' }))).toBe(false);
    expect(podeDispensar(alerta({ gravidade: 'urgente' }))).toBe(false);
  });
});

describe('dispensar e repor', () => {
  it('esconde o alerta e persiste a decisão', () => {
    const d = dispensar({}, alerta());
    expect(estaDispensado(d, alerta())).toBe(true);
    expect(lerDispensas()).toEqual({ 'vac-a1': 'info' });
  });

  it('repor volta a mostrar e apaga do armazenamento', () => {
    const d = reporDispensa(dispensar({}, alerta()), 'vac-a1');
    expect(estaDispensado(d, alerta())).toBe(false);
    expect(lerDispensas()).toEqual({});
  });

  it('filtrarDispensados tira só o que foi calado', () => {
    const outro = alerta({ id: 'snira-a2', categoria: 'snira', diasRestantes: 2 });
    const d = dispensar({}, alerta());
    expect(filtrarDispensados([alerta(), outro], d).map((a) => a.id)).toEqual(['snira-a2']);
  });
});

describe('o alerta volta quando se agrava', () => {
  it('um alerta calado em info reaparece se passar a urgente', () => {
    const d = dispensar({}, alerta({ gravidade: 'info' }));
    expect(estaDispensado(d, alerta({ gravidade: 'urgente' }))).toBe(false);
  });

  it('continua calado enquanto a gravidade não piorar', () => {
    const d = dispensar({}, alerta({ gravidade: 'aviso' }));
    expect(estaDispensado(d, alerta({ gravidade: 'aviso' }))).toBe(true);
    expect(estaDispensado(d, alerta({ gravidade: 'info' }))).toBe(true); // melhorou
  });
});

describe('resistência a lixo no armazenamento', () => {
  it('trata JSON corrompido como se não houvesse dispensas', () => {
    mockMapa.set('gado.alertas-dispensados.v1', '{isto não é json}');
    expect(lerDispensas()).toEqual({});
  });

  it('descarta entradas com gravidade inválida', () => {
    // Um valor estranho aqui silenciaria um alerta sem ninguém ter pedido.
    mockMapa.set(
      'gado.alertas-dispensados.v1',
      JSON.stringify({ 'vac-a1': 'catastrofico', 'vac-a2': 'info' }),
    );
    expect(lerDispensas()).toEqual({ 'vac-a2': 'info' });
  });

  it('não rebenta se o guardado for um array', () => {
    mockMapa.set('gado.alertas-dispensados.v1', '["info"]');
    expect(lerDispensas()).toEqual({});
  });
});

describe('limparObsoletas', () => {
  it('esquece dispensas de alertas que já não existem', () => {
    const d = { 'vac-a1': 'info' as const, 'vac-a2': 'info' as const };
    expect(limparObsoletas(d, new Set(['vac-a2']))).toEqual({ 'vac-a2': 'info' });
  });

  it('devolve null quando não há nada a limpar (evita escrita inútil)', () => {
    const d = { 'vac-a1': 'info' as const };
    expect(limparObsoletas(d, new Set(['vac-a1']))).toBeNull();
  });
});
