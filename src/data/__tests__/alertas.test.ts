import { describe, expect, it } from '@jest/globals';

import { comRelogio } from '../../testUtils/relogio';
import { computeAlertas } from '../alertas';
import { diaIso, isoDaysAgo, isoInDays } from '../helpers';
import type { Animal, Evento, Medicamento } from '../types';

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

function evento(over: Partial<Evento> & Pick<Evento, 'tipo'>): Evento {
  return {
    id: `e-${over.tipo}-${over.data ?? ''}`,
    animalId: 'a1',
    data: isoDaysAgo(1),
    descricao: '',
    ...over,
  };
}

function lote(over: Partial<Medicamento> = {}): Medicamento {
  return {
    id: 'm1',
    exploracaoId: 'exp-1',
    nome: 'Penicilina',
    tipo: 'Medicamento',
    quantidade: 100,
    unidade: 'ml',
    intervaloSegurancaDias: 10,
    dataCompra: diaIso(isoDaysAgo(30)),
    ...over,
  };
}

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

describe('computeAlertas — SNIRA (nascimento)', () => {
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

describe('computeAlertas — SNIRA (mortes e saídas)', () => {
  const vendida = animal({
    estado: 'vendido',
    numeroIdentificacao: 'PT123',
    dataSaida: diaIso(isoDaysAgo(2)),
  });

  it('avisa que falta comunicar uma venda', () => {
    const alertas = computeAlertas(
      [vendida],
      [evento({ tipo: 'Venda', data: isoDaysAgo(2), comunicadoSnira: false })],
    );
    const snira = alertas.find((a) => a.categoria === 'snira');
    expect(snira).toBeDefined();
    expect(snira?.titulo).toMatch(/saída/i);
    // Sete dias de prazo, dois já passados.
    expect(snira?.diasRestantes).toBe(5);
  });

  it('fica urgente quando o prazo de sete dias já passou', () => {
    const alertas = computeAlertas(
      [vendida],
      [evento({ tipo: 'Venda', data: isoDaysAgo(20), comunicadoSnira: false })],
    );
    expect(alertas.find((a) => a.categoria === 'snira')?.gravidade).toBe('urgente');
  });

  it('cala-se assim que a comunicação é marcada', () => {
    const alertas = computeAlertas(
      [vendida],
      [evento({ tipo: 'Venda', data: isoDaysAgo(2), comunicadoSnira: true })],
    );
    expect(alertas.some((a) => a.categoria === 'snira')).toBe(false);
  });

  it('ignora eventos que a lei não manda comunicar', () => {
    // Uma pesagem marcada como pendente (registo antigo, engano) não pode
    // aparecer numa lista que se leva para o portal: lá não há onde a meter.
    const alertas = computeAlertas(
      [animal({ numeroIdentificacao: 'PT123' })],
      [evento({ tipo: 'Pesagem', data: isoDaysAgo(2), comunicadoSnira: false })],
    );
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

  it('e o prazo não muda a meio do dia', () => {
    // A data da vacinação fica gravada ao meio-dia (`parseDataPt`). Enquanto o
    // prazo era medido em horas, "revacinar em N dias" contava um dia a mais até
    // ao meio-dia e um a menos a partir dele — o mesmo número a mudar sozinho
    // com o almoço, num alerta que o criador usa para marcar o veterinário.
    const aoMeioDiaDe = (ano: number, mes: number, dia: number) =>
      new Date(ano, mes - 1, dia, 12, 0, 0).toISOString();

    for (const hora of [0, 9, 11, 13, 23]) {
      comRelogio([2026, 8, 8, hora, 30], () => {
        const a = animal({ numeroIdentificacao: 'PT1' });
        // Vacinado há 360 dias: faltam 5 para o ano.
        const eventos: Evento[] = [
          evento({ tipo: 'Vacinação', data: aoMeioDiaDe(2025, 8, 13) }),
        ];
        const vac = computeAlertas([a], eventos).find((x) => x.categoria === 'vacinacao');
        expect(vac?.diasRestantes).toBe(5);
        expect(vac?.descricao).toContain('última há 360 dias');
      });
    }
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

describe('computeAlertas — reprodução', () => {
  const vaca = animal({ numeroIdentificacao: 'PT1' });

  it('avisa que falta o diagnóstico depois de a cobrição assentar', () => {
    const alertas = computeAlertas(
      [vaca],
      [evento({ tipo: 'Cobrição', data: isoDaysAgo(40) })],
    );
    const diag = alertas.find((a) => a.categoria === 'reproducao');
    expect(diag?.titulo).toMatch(/diagnóstico/i);
    expect(diag?.gravidade).toBe('aviso');
  });

  it('cala-se enquanto for cedo de mais para diagnosticar', () => {
    // Aos dez dias a ecografia não vê nada: mandar chamar o veterinário era
    // mandá-lo fazer a viagem por nada.
    const alertas = computeAlertas(
      [vaca],
      [evento({ tipo: 'Cobrição', data: isoDaysAgo(10) })],
    );
    expect(alertas.some((a) => a.categoria === 'reproducao')).toBe(false);
  });

  it('sobe a urgente quando o atraso já custa o ciclo', () => {
    const alertas = computeAlertas(
      [vaca],
      [evento({ tipo: 'Cobrição', data: isoDaysAgo(80) })],
    );
    expect(alertas.find((a) => a.categoria === 'reproducao')?.gravidade).toBe('urgente');
  });

  it('desaparece assim que o diagnóstico é registado', () => {
    const alertas = computeAlertas(
      [vaca],
      [
        evento({ tipo: 'Cobrição', data: isoDaysAgo(80) }),
        evento({ tipo: 'Diagnóstico', data: isoDaysAgo(40), resultado: 'gestante' }),
      ],
    );
    expect(alertas.some((a) => a.categoria === 'reproducao')).toBe(false);
  });

  it('avisa a vaca parada desde o parto', () => {
    const alertas = computeAlertas([vaca], [evento({ tipo: 'Parto', data: isoDaysAgo(120) })]);
    const parada = alertas.find((a) => a.titulo === 'Sem cobrição desde o parto');
    expect(parada).toBeDefined();
    expect(parada?.descricao).toMatch(/120 dias/);
  });

  it('não a avisa enquanto ela estiver dentro do prazo normal', () => {
    const alertas = computeAlertas([vaca], [evento({ tipo: 'Parto', data: isoDaysAgo(40) })]);
    expect(alertas.some((a) => a.titulo === 'Sem cobrição desde o parto')).toBe(false);
  });

  it('não a avisa se já voltou a ser coberta', () => {
    const alertas = computeAlertas(
      [vaca],
      [
        evento({ tipo: 'Parto', data: isoDaysAgo(120) }),
        evento({ tipo: 'Cobrição', data: isoDaysAgo(20) }),
      ],
    );
    expect(alertas.some((a) => a.titulo === 'Sem cobrição desde o parto')).toBe(false);
  });

  it('deixa a novilha em paz — nunca pariu, não está parada', () => {
    // Sem este filtro, todas as fêmeas adultas que nunca pariram apareciam na
    // lista de "paradas desde o parto", que é uma frase sem sentido para elas.
    const novilha = animal({ id: 'n1', numeroIdentificacao: 'PT9' });
    const alertas = computeAlertas([novilha], []);
    expect(alertas.some((a) => a.titulo === 'Sem cobrição desde o parto')).toBe(false);
  });
});

describe('computeAlertas — existências', () => {
  it('é urgente quando um lote com stock passou a validade', () => {
    const alertas = computeAlertas([], [], [lote({ validade: diaIso(isoDaysAgo(5)) })]);
    const val = alertas.find((a) => a.categoria === 'existencias');
    expect(val?.gravidade).toBe('urgente');
    expect(val?.animalId).toBeUndefined();
    expect(val?.medicamentoId).toBe('m1');
  });

  it('cala-se num lote expirado que já estava vazio', () => {
    // Não há nada para tirar da prateleira: avisar era encher a lista com um
    // problema que se resolveu sozinho.
    const alertas = computeAlertas(
      [],
      [evento({ tipo: 'Medicamento', medicamentoId: 'm1', quantidade: 100 })],
      [lote({ validade: diaIso(isoDaysAgo(5)) })],
    );
    expect(alertas.some((a) => a.categoria === 'existencias')).toBe(false);
  });

  it('avisa com antecedência a validade a terminar', () => {
    const alertas = computeAlertas([], [], [lote({ validade: diaIso(isoInDays(20)) })]);
    const val = alertas.find((a) => a.categoria === 'existencias');
    expect(val?.titulo).toMatch(/validade/i);
    expect(val?.gravidade).toBe('info');
  });

  it('avisa que o frasco está a acabar', () => {
    const alertas = computeAlertas(
      [],
      [evento({ tipo: 'Medicamento', medicamentoId: 'm1', quantidade: 90 })],
      [lote()],
    );
    const stock = alertas.find((a) => a.categoria === 'existencias');
    expect(stock?.titulo).toMatch(/acabar/i);
    expect(stock?.descricao).toMatch(/restam 10 ml/i);
  });

  it('não diz nada de um lote cheio e dentro da validade', () => {
    expect(computeAlertas([], [], [lote({ validade: diaIso(isoInDays(365)) })])).toHaveLength(0);
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
