import type { Animal, Evento } from '../types';
import {
  computeAlertas,
  diasAte,
  idadeDias,
  isoDaysAgo,
  isoInDays,
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
