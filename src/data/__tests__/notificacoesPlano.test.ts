/**
 * Testes do plano de avisos no telemóvel.
 *
 * Porquê: um aviso agendado para a hora errada não dá erro nenhum — só não
 * toca, ou toca a meio da noite. O criador só descobre quando o prazo do
 * brinco passou e ficou com coima. Como isto agenda para o futuro, nenhum
 * teste manual apanha o engano no momento em que se escreve o código.
 */

import { describe, expect, it } from '@jest/globals';

import { PREF_OMISSAO, type Preferencias } from '../notificacoes';
import { HORA_AVISO, HORIZONTE_DIAS, MAX_AGENDADAS, planear, quandoTocar } from '../notificacoesPlano';
import type { Alerta } from '../types';

/** Uma quarta-feira às 10:00 — depois da hora de aviso, para expor o caso. */
const AGORA = new Date(2026, 6, 15, 10, 0, 0);

function alerta(id: string, patch: Partial<Alerta> = {}): Alerta {
  return {
    id,
    categoria: 'identificacao',
    gravidade: 'info',
    titulo: 'Falta identificar (brinco)',
    descricao: 'Colocar brinco.',
    animalId: 'a1',
    diasRestantes: 30,
    ...patch,
  };
}

describe('quandoTocar', () => {
  it('agenda à hora de aviso, não à hora em que se mexeu na app', () => {
    const d = quandoTocar(3, AGORA);
    expect(d.getHours()).toBe(HORA_AVISO);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(18);
  });

  it('empurra para amanhã quando a hora de hoje já passou', () => {
    // Agendar no passado faria a notificação disparar de imediato: a app a
    // apitar mal se abre, sem nada de novo ter acontecido.
    const d = quandoTocar(0, AGORA);
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(HORA_AVISO);
  });

  it('agenda ainda para hoje se a hora de aviso não chegou', () => {
    const madrugada = new Date(2026, 6, 15, 5, 0, 0);
    const d = quandoTocar(0, madrugada);
    expect(d.getDate()).toBe(15);
  });

  it('nunca agenda para trás, mesmo com prazo vencido há muito', () => {
    const d = quandoTocar(-40, AGORA);
    expect(d.getTime()).toBeGreaterThan(AGORA.getTime());
  });
});

describe('planear', () => {
  it('toca no dia em que o alerta entra na janela de antecedência', () => {
    // 30 dias de prazo, avisar com 20 de antecedência → daqui a 10 dias.
    const plano = planear([alerta('x', { diasRestantes: 30 })], PREF_OMISSAO, AGORA);
    expect(plano).toHaveLength(1);
    expect(plano[0].quando.getDate()).toBe(25);
  });

  it('avisa já amanhã se o prazo entrou na janela sem a app aberta', () => {
    const plano = planear([alerta('x', { diasRestantes: 3 })], PREF_OMISSAO, AGORA);
    expect(plano[0].quando.getDate()).toBe(16);
  });

  it('ignora avisos sem prazo a correr', () => {
    // "Sem registo de vacinação" não tem data nenhuma: tocar no telemóvel por
    // causa disso é exatamente o ruído que faz desligar as notificações.
    const plano = planear(
      [alerta('x', { categoria: 'vacinacao', diasRestantes: undefined })],
      PREF_OMISSAO,
      AGORA,
    );
    expect(plano).toEqual([]);
  });

  it('respeita as categorias desligadas', () => {
    const prefs: Preferencias = {
      ...PREF_OMISSAO,
      ativa: { ...PREF_OMISSAO.ativa, identificacao: false },
    };
    expect(planear([alerta('x')], prefs, AGORA)).toEqual([]);
  });

  it('não agenda para lá do horizonte', () => {
    const longe = alerta('x', { diasRestantes: HORIZONTE_DIAS + 200 });
    expect(planear([longe], PREF_OMISSAO, AGORA)).toEqual([]);
  });

  it('corta pelo limite do sistema, deixando passar os mais próximos', () => {
    // O iOS guarda 64 pendentes e descarta o resto em silêncio. Se o corte
    // fosse pela ordem de chegada, um efetivo grande podia empurrar para fora
    // precisamente o prazo que está a vencer.
    const muitos = Array.from({ length: MAX_AGENDADAS + 20 }, (_, i) =>
      alerta(`a${i}`, { diasRestantes: 21 + i }),
    );

    const plano = planear([...muitos].reverse(), PREF_OMISSAO, AGORA);

    expect(plano).toHaveLength(MAX_AGENDADAS);
    const datas = plano.map((p) => p.quando.getTime());
    expect([...datas].sort((a, b) => a - b)).toEqual(datas); // por ordem
    expect(plano[0].alerta.id).toBe('a0'); // o mais próximo sobrevive
  });
});
