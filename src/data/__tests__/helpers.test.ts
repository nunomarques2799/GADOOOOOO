import { describe, expect, it } from '@jest/globals';

import type { Animal, Evento } from '../types';
import {
  computeAlertas,
  diasAte,
  idadeDias,
  isoDaysAgo,
  isoInDays,
  isoMaisDias,
  parseDataPt,
} from '../helpers';

/** Cria um animal com o mínimo obrigatório; sobrepõe o resto. */
function animal(over: Partial<Animal> = {}): Animal {
  return {
    id: 'a1',
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: isoDaysAgo(400),
    ...over,
  };
}

describe('parseDataPt', () => {
  it('aceita dd/mm/aaaa e dd-mm-aaaa no passado', () => {
    expect(parseDataPt('15/03/2021')).not.toBeNull();
    expect(parseDataPt('15-03-2021')).not.toBeNull();
  });

  it('rejeita dias/meses fora do intervalo', () => {
    expect(parseDataPt('32/01/2021')).toBeNull();
    expect(parseDataPt('00/01/2021')).toBeNull();
    expect(parseDataPt('15/13/2021')).toBeNull();
  });

  it('rejeita datas inexistentes (ex: 31 de fevereiro)', () => {
    expect(parseDataPt('31/02/2021')).toBeNull();
  });

  it('rejeita datas no futuro e texto inválido', () => {
    expect(parseDataPt('01/01/2999')).toBeNull();
    expect(parseDataPt('amanhã')).toBeNull();
    expect(parseDataPt('')).toBeNull();
  });

  it('aceita o futuro quando explicitamente pedido', () => {
    // A data prevista do parto é futura por definição — sem esta exceção não
    // havia forma nenhuma de a registar.
    expect(parseDataPt('01/01/2999', { permitirFuturo: true })).not.toBeNull();
  });

  it('continua a validar o resto mesmo a permitir futuro', () => {
    expect(parseDataPt('31/02/2999', { permitirFuturo: true })).toBeNull();
  });
});

describe('isoMaisDias', () => {
  it('soma dias e fixa a hora ao meio-dia', () => {
    // Meio-dia evita que fusos horários passem a data para o dia anterior.
    const d = new Date(isoMaisDias('2026-03-01T12:00:00.000Z', 283));
    expect(d.getHours()).toBe(12);
    expect(diasAte(isoMaisDias(new Date().toISOString(), 10))).toBe(10);
  });
});

describe('idadeDias / diasAte', () => {
  it('idadeDias conta dias desde o nascimento', () => {
    expect(idadeDias(isoDaysAgo(10))).toBe(10);
  });

  it('diasAte é positivo no futuro e negativo no passado', () => {
    expect(diasAte(isoInDays(5))).toBeGreaterThan(0);
    expect(diasAte(isoDaysAgo(5))).toBeLessThan(0);
  });
});

describe('computeAlertas — identificação (brinco)', () => {
  it('avisa a colocar brinco em bovino jovem sem identificação', () => {
    const [alerta] = computeAlertas([animal({ dataNascimento: isoDaysAgo(2) })]);
    expect(alerta.categoria).toBe('identificacao');
    expect(alerta.gravidade).toBe('info');
  });

  it('marca como urgente quando o prazo de 20 dias foi excedido', () => {
    const alertas = computeAlertas([animal({ dataNascimento: isoDaysAgo(30) })]);
    const id = alertas.find((a) => a.categoria === 'identificacao');
    expect(id?.gravidade).toBe('urgente');
  });

  it('não gera alerta de identificação para não-bovinos', () => {
    const alertas = computeAlertas([
      animal({ especie: 'Ovino', dataNascimento: isoDaysAgo(30) }),
    ]);
    expect(alertas.some((a) => a.categoria === 'identificacao')).toBe(false);
  });
});

describe('computeAlertas — SNIRA', () => {
  it('é urgente quando a comunicação está em atraso', () => {
    const alertas = computeAlertas([
      animal({
        numeroIdentificacao: 'PT123',
        dataIdentificacao: isoDaysAgo(10),
        comunicadoSnira: false,
      }),
    ]);
    const snira = alertas.find((a) => a.categoria === 'snira');
    expect(snira?.gravidade).toBe('urgente');
  });

  it('não gera alerta se já foi comunicado', () => {
    const alertas = computeAlertas([
      animal({
        numeroIdentificacao: 'PT123',
        dataIdentificacao: isoDaysAgo(10),
        comunicadoSnira: true,
      }),
    ]);
    expect(alertas.some((a) => a.categoria === 'snira')).toBe(false);
  });
});

describe('computeAlertas — revacinação', () => {
  it('é urgente quando passou mais de um ano da última vacinação', () => {
    const a = animal({ numeroIdentificacao: 'PT1' });
    const eventos: Evento[] = [
      { id: 'e1', animalId: a.id, tipo: 'Vacinação', data: isoDaysAgo(400), descricao: '' },
    ];
    const vac = computeAlertas([a], eventos).find((x) => x.categoria === 'vacinacao');
    expect(vac?.gravidade).toBe('urgente');
  });
});

describe('computeAlertas — parto previsto', () => {
  it('avisa a partir de duas semanas antes', () => {
    const a = animal({ numeroIdentificacao: 'PT1', dataPrevistaParto: isoInDays(10) });
    const parto = computeAlertas([a]).find((x) => x.categoria === 'parto');
    expect(parto?.diasRestantes).toBe(10);
  });

  it('não avisa enquanto o parto estiver longe', () => {
    const a = animal({ numeroIdentificacao: 'PT1', dataPrevistaParto: isoInDays(90) });
    expect(computeAlertas([a]).some((x) => x.categoria === 'parto')).toBe(false);
  });

  it('deixa de contar dias quando a previsão caduca', () => {
    // Passado um mês, contar "em atraso há 200 dias" não ajuda ninguém e o
    // aviso ficava preso na lista para sempre. Sem `diasRestantes` passa a ser
    // dispensável, e o texto pede o que falta mesmo: dizer o que aconteceu.
    const a = animal({ numeroIdentificacao: 'PT1', dataPrevistaParto: isoDaysAgo(200) });
    const parto = computeAlertas([a]).find((x) => x.categoria === 'parto');
    expect(parto?.diasRestantes).toBeUndefined();
    expect(parto?.titulo).toMatch(/por confirmar/i);
  });
});

describe('computeAlertas — animais que saíram do efetivo', () => {
  it('não gera nenhum alerta para animais falecidos/vendidos', () => {
    const falecido = animal({ estado: 'falecido', dataNascimento: isoDaysAgo(30) });
    expect(computeAlertas([falecido])).toHaveLength(0);
  });
});

describe('computeAlertas — ordenação', () => {
  it('coloca os urgentes antes dos informativos', () => {
    const urgente = animal({ id: 'u', dataNascimento: isoDaysAgo(30) }); // id em atraso
    const info = animal({ id: 'i', dataNascimento: isoDaysAgo(2) }); // id a tempo
    const alertas = computeAlertas([info, urgente]);
    expect(alertas[0].gravidade).toBe('urgente');
  });
});
