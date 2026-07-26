/**
 * Testes da EXECUÇÃO do agendamento (a decisão do que agendar é do
 * `notificacoesPlano.ts`, testada à parte).
 *
 * Porquê: `agendar` cancela tudo e depois agenda os avisos um a um, com um
 * `await` em cada — não é instantâneo. E o store reagenda a cada mudança de
 * alertas, o que numa sincronização acontece várias vezes seguidas. Duas
 * passagens em voo ao mesmo tempo entrelaçam-se: o `cancelAll` da segunda apaga
 * os avisos que a primeira acabou de pôr, e a primeira continua a agendar por
 * cima do plano novo. O que sai daí é imprevisível, não dá erro nenhum, e o
 * sintoma é um prazo legal que simplesmente não toca — descoberto semanas
 * depois, com a coima já aplicada.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PREF_OMISSAO } from '../notificacoes';
import type { Alerta } from '../types';

/**
 * `expo-notifications` simulado. O `mockRegisto` guarda a ORDEM real das operações
 * contra o sistema — é nela que uma sobreposição se vê, e não no total.
 *
 * `mockAgendarLento` obriga cada agendamento a esperar um turno da fila de
 * microtarefas: é o que dá a uma segunda chamada a oportunidade de entrar a
 * meio, tal como acontece no telemóvel.
 */
const mockRegisto: string[] = [];
let mockAgendarLento = false;

jest.mock('expo-notifications', () => ({
  setNotificationHandler: () => undefined,
  setNotificationChannelAsync: async () => undefined,
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: async () => ({ granted: true }),
  cancelAllScheduledNotificationsAsync: async () => {
    mockRegisto.push('cancelar');
  },
  scheduleNotificationAsync: async ({ content }: { content: { title: string } }) => {
    if (mockAgendarLento) await Promise.resolve();
    mockRegisto.push(`agendar:${content.title}`);
  },
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { agendar, cancelarTudo } from '../notificacoesLocais';

function alerta(id: string): Alerta {
  return {
    id,
    categoria: 'identificacao',
    gravidade: 'info',
    titulo: id,
    descricao: 'Colocar brinco.',
    animalId: `animal-${id}`,
    diasRestantes: 10,
  };
}

beforeEach(() => {
  mockRegisto.length = 0;
  mockAgendarLento = false;
});

describe('agendar — uma passagem de cada vez', () => {
  it('não entrelaça duas passagens: nunca cancela a meio de agendar', async () => {
    mockAgendarLento = true;

    // Duas passagens lançadas quase ao mesmo tempo, como numa sincronização.
    const primeira = agendar([alerta('a'), alerta('b')], PREF_OMISSAO);
    const segunda = agendar([alerta('c'), alerta('d')], PREF_OMISSAO);
    await Promise.all([primeira, segunda]);

    // A prova é a forma do registo: depois de um "cancelar" só podem vir
    // agendamentos até ao fim, ou outro "cancelar" sem nada agendado pelo meio.
    // Um "cancelar" a seguir a agendamentos que não fecharam o seu plano é
    // exatamente a sobreposição que apagava avisos já postos.
    const cancelamentos = mockRegisto.filter((r) => r === 'cancelar').length;
    expect(cancelamentos).toBe(1);
    expect(mockRegisto[0]).toBe('cancelar');
  });

  it('a passagem ultrapassada desiste, e vale o plano mais recente', async () => {
    mockAgendarLento = true;

    const primeira = agendar([alerta('velho')], PREF_OMISSAO);
    const segunda = agendar([alerta('novo')], PREF_OMISSAO);
    const [nPrimeira, nSegunda] = await Promise.all([primeira, segunda]);

    // A do meio não chega a mexer no sistema: já está desatualizada, e cada
    // passagem custa até 50 idas ao sistema operativo.
    expect(nPrimeira).toBe(0);
    expect(nSegunda).toBe(1);
    expect(mockRegisto).toEqual(['cancelar', 'agendar:novo']);
  });

  it('desligar os avisos entra na mesma fila que agendar', async () => {
    mockAgendarLento = true;

    // Sem uma fila só, o cancelar podia correr ANTES de o agendamento acabar —
    // e o criador ficava com avisos no telemóvel depois de os ter desligado.
    const aAgendar = agendar([alerta('a'), alerta('b')], PREF_OMISSAO);
    const aDesligar = cancelarTudo();
    await Promise.all([aAgendar, aDesligar]);

    expect(mockRegisto[mockRegisto.length - 1]).toBe('cancelar');
    expect(mockRegisto.filter((r) => r.startsWith('agendar:'))).toEqual([]);
  });

  it('um erro numa passagem não tranca as seguintes', async () => {
    // A fila é partilhada: se ficasse rejeitada, uma falha isolada (permissão
    // retirada a meio) deixava a app sem reagendar mais nada até reiniciar.
    const explosiva = agendar([alerta('a')], {
      ...PREF_OMISSAO,
      // `ativa` sem a categoria faz `planear` rebentar ao ler `p.ativa[cat]`?
      // Não — devolve undefined e o alerta é filtrado. Para forçar a falha, é o
      // próprio `antecedenciaDias` que se tira.
      antecedenciaDias: undefined as unknown as typeof PREF_OMISSAO.antecedenciaDias,
    }).catch(() => 'falhou');

    expect(await explosiva).toBe('falhou');

    mockRegisto.length = 0;
    expect(await agendar([alerta('depois')], PREF_OMISSAO)).toBe(1);
    expect(mockRegisto).toEqual(['cancelar', 'agendar:depois']);
  });
});
