import { describe, expect, it } from '@jest/globals';

import {
  agruparEventosPorDia,
  diaVizinho,
  problemaComEvento,
  rotuloDoDia,
  type EventoAgenda,
} from '../agenda';

/** Um evento com o mínimo preenchido, para os testes só dizerem o que importa. */
function ev(p: Partial<EventoAgenda> & { id: string; dia: string }): EventoAgenda {
  return {
    exploracaoId: 'exp-1',
    criadoPor: 'u1',
    titulo: 'Evento',
    publico: true,
    criadoEm: '2026-08-01T10:00:00.000Z',
    ...p,
  };
}

describe('problemaComEvento — uma frase por engano', () => {
  it('aceita o mínimo: título e dia', () => {
    expect(problemaComEvento('Feira', '2026-08-12T00:00:00.000Z', '')).toBeNull();
  });

  it('sem título não há evento nenhum', () => {
    expect(problemaComEvento('   ', '2026-08-12T00:00:00.000Z', '')).toMatch(/Escreva o que é/);
  });

  it('sem dia também não', () => {
    expect(problemaComEvento('Feira', null, '')).toMatch(/dia/);
  });

  it('a hora é opcional, mas escrita tem de se perceber', () => {
    const dia = '2026-08-12T00:00:00.000Z';
    // Em branco passa: "dia 12 há feira" é um evento completo.
    expect(problemaComEvento('Feira', dia, '')).toBeNull();
    expect(problemaComEvento('Feira', dia, '09:00')).toBeNull();
    // Meio escrita não passa. Sem esta, "18:" gravava um evento marcado para
    // hora nenhuma e o calendário mostrava-o como se tivesse hora.
    expect(problemaComEvento('Feira', dia, '18:')).toMatch(/09:00/);
    expect(problemaComEvento('Feira', dia, '99:99')).toMatch(/09:00/);
  });

  it('recusa um título que não cabe no calendário', () => {
    expect(problemaComEvento('x'.repeat(200), '2026-08-12T00:00:00.000Z', '')).toMatch(
      /comprido/,
    );
  });
});

describe('agruparEventosPorDia', () => {
  it('junta por dia e ordena por hora dentro do dia', () => {
    const m = agruparEventosPorDia([
      ev({ id: 'c', dia: '2026-08-12', hora: '16:00', titulo: 'Tarde' }),
      ev({ id: 'a', dia: '2026-08-12', hora: '09:00', titulo: 'Manhã' }),
      ev({ id: 'z', dia: '2026-08-13', titulo: 'Outro dia' }),
    ]);
    expect([...m.keys()].sort()).toEqual(['2026-08-12', '2026-08-13']);
    expect(m.get('2026-08-12')!.map((e) => e.titulo)).toEqual(['Manhã', 'Tarde']);
  });

  it('os do dia inteiro ficam à frente dos que têm hora', () => {
    // Sem isto, o `undefined` da hora ordenava como texto e punha a feira do
    // dia inteiro no meio da tarde.
    const m = agruparEventosPorDia([
      ev({ id: 'a', dia: '2026-08-12', hora: '08:00', titulo: 'Com hora' }),
      ev({ id: 'b', dia: '2026-08-12', titulo: 'Todo o dia' }),
    ]);
    expect(m.get('2026-08-12')!.map((e) => e.titulo)).toEqual(['Todo o dia', 'Com hora']);
  });

  it('dois do dia inteiro ordenam-se pelo título', () => {
    const m = agruparEventosPorDia([
      ev({ id: 'a', dia: '2026-08-12', titulo: 'Zebra' }),
      ev({ id: 'b', dia: '2026-08-12', titulo: 'Aveia' }),
    ]);
    expect(m.get('2026-08-12')!.map((e) => e.titulo)).toEqual(['Aveia', 'Zebra']);
  });
});

describe('diaVizinho — as setas do modal', () => {
  it('anda um dia para cada lado', () => {
    expect(diaVizinho('2026-08-12', 1)).toBe('2026-08-13');
    expect(diaVizinho('2026-08-12', -1)).toBe('2026-08-11');
  });

  it('salta o fim do mês e o fim do ano sem se enganar', () => {
    expect(diaVizinho('2026-08-31', 1)).toBe('2026-09-01');
    expect(diaVizinho('2026-09-01', -1)).toBe('2026-08-31');
    expect(diaVizinho('2026-12-31', 1)).toBe('2027-01-01');
    expect(diaVizinho('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('acerta com o 29 de fevereiro de um ano bissexto', () => {
    expect(diaVizinho('2028-02-28', 1)).toBe('2028-02-29');
    expect(diaVizinho('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('rotuloDoDia', () => {
  // Um dia à hora do almoço: com a meia-noite, qualquer erro de fuso escondia-se
  // atrás do arredondamento.
  const hoje = new Date(2026, 7, 12, 13, 30);

  it('dá nome aos três dias que se dizem por nome', () => {
    expect(rotuloDoDia('2026-08-12', hoje)).toBe('Hoje');
    expect(rotuloDoDia('2026-08-13', hoje)).toBe('Amanhã');
    expect(rotuloDoDia('2026-08-11', hoje)).toBe('Ontem');
  });

  it('para o resto não inventa nada', () => {
    expect(rotuloDoDia('2026-08-20', hoje)).toBe('');
  });

  it('funciona na virada do mês', () => {
    const fimDoMes = new Date(2026, 7, 31, 13, 30);
    expect(rotuloDoDia('2026-09-01', fimDoMes)).toBe('Amanhã');
  });
});
