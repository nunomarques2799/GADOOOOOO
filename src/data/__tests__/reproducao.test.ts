import { describe, expect, it } from '@jest/globals';

import { isoDaysAgo, isoInDays } from '../helpers';
import {
  aguardamDiagnostico,
  elegivelParaReproducao,
  estadoReprodutivo,
  prestesAParir,
  preverParto,
  resumoReproducao,
  semCobricaoAposParto,
} from '../reproducao';
import type { Animal, Evento } from '../types';

function vaca(over: Partial<Animal> = {}): Animal {
  return {
    id: 'a1',
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: isoDaysAgo(365 * 5),
    numeroIdentificacao: 'PT1',
    ...over,
  };
}

function ev(tipo: Evento['tipo'], diasAtras: number, over: Partial<Evento> = {}): Evento {
  return {
    id: `${tipo}-${diasAtras}`,
    animalId: 'a1',
    tipo,
    data: isoDaysAgo(diasAtras),
    descricao: '',
    ...over,
  };
}

describe('elegivelParaReproducao', () => {
  it('deixa de fora machos e quem já saiu do efetivo', () => {
    expect(elegivelParaReproducao(vaca({ sexo: 'Macho' }))).toBe(false);
    expect(elegivelParaReproducao(vaca({ estado: 'vendido' }))).toBe(false);
    expect(elegivelParaReproducao(vaca({ estado: 'eliminado' }))).toBe(false);
  });

  it('deixa de fora as vitelas — senão a lista de "vazias" é o efetivo todo', () => {
    expect(elegivelParaReproducao(vaca({ dataNascimento: isoDaysAgo(200) }))).toBe(false);
  });

  it('mas uma novilha JÁ COBERTA entra, tenha a idade que tiver', () => {
    // A régua da idade existe para não encher a lista de animais que ainda não
    // andam à reprodução. Uma novilha coberta aos catorze meses anda — e é
    // precisamente ela que não se pode perder de vista até ao diagnóstico.
    const nova = vaca({ dataNascimento: isoDaysAgo(420) });
    expect(elegivelParaReproducao(nova)).toBe(false);
    expect(elegivelParaReproducao(nova, true)).toBe(true);
  });
});

describe('estadoReprodutivo — o ciclo lido dos eventos', () => {
  it('sem eventos nenhuns está vazia', () => {
    expect(estadoReprodutivo(vaca(), []).fase).toBe('vazia');
  });

  it('coberta e sem diagnóstico fica coberta, com os dias a contar', () => {
    const e = estadoReprodutivo(vaca(), [ev('Cobrição', 40, { detalhe: 'Touro: Marquês' })]);
    expect(e.fase).toBe('coberta');
    expect(e.diasNaFase).toBe(40);
    expect(e.detalheCobricao).toBe('Touro: Marquês');
  });

  it('um diagnóstico gestante prevê o parto a partir da cobrição que o originou', () => {
    const e = estadoReprodutivo(vaca(), [
      ev('Cobrição', 100),
      ev('Diagnóstico', 60, { resultado: 'gestante' }),
    ]);
    expect(e.fase).toBe('gestante');
    // 283 dias de gestação de bovino, contados da cobrição de há 100 dias.
    expect(e.diasParaParto).toBe(283 - 100);
  });

  it('um diagnóstico vazia devolve-a à lista de quem cobrir', () => {
    const e = estadoReprodutivo(vaca(), [
      ev('Cobrição', 100),
      ev('Diagnóstico', 60, { resultado: 'vazia' }),
    ]);
    expect(e.fase).toBe('vazia');
  });

  it('um diagnóstico sem resultado trata-se como duvidoso, não como vazio', () => {
    // Dá-lo por vazio mandava cobrir uma vaca que pode estar prenhe; dá-lo por
    // gestante era pior ainda. Duvidoso é o único que não mente.
    const e = estadoReprodutivo(vaca(), [ev('Cobrição', 100), ev('Diagnóstico', 60)]);
    expect(e.fase).toBe('duvidosa');
  });

  it('o ciclo recomeça no parto — o que é anterior não conta', () => {
    // Sem esta régua, um diagnóstico de gestação de 2024 dava a vaca por prenhe
    // três anos seguidos, mesmo depois de ela ter parido duas vezes.
    const e = estadoReprodutivo(vaca(), [
      ev('Cobrição', 400),
      ev('Diagnóstico', 350, { resultado: 'gestante' }),
      ev('Parto', 120),
    ]);
    expect(e.fase).toBe('vazia');
    expect(e.diasDesdeUltimoParto).toBe(120);
    expect(e.partos).toBe(1);
  });

  it('em empate de data ganha a cobrição — deu vazia e foi logo ao touro', () => {
    const e = estadoReprodutivo(vaca(), [
      ev('Diagnóstico', 30, { resultado: 'vazia' }),
      ev('Cobrição', 30),
    ]);
    expect(e.fase).toBe('coberta');
  });

  it('aceita a data de parto escrita à mão na ficha, sem eventos nenhuns', () => {
    // É como a app fazia antes de existirem estes eventos. Ignorá-lo agora
    // tirava da lista de "prestes a parir" as vacas que lá estavam ontem.
    const e = estadoReprodutivo(vaca({ dataPrevistaParto: isoInDays(20) }), []);
    expect(e.fase).toBe('gestante');
    expect(e.diasParaParto).toBe(20);
  });

  it('mas ignora uma data de parto anterior ao último parto — é lixo de um ciclo antigo', () => {
    const e = estadoReprodutivo(
      vaca({ dataPrevistaParto: isoDaysAgo(200) }),
      [ev('Parto', 100)],
    );
    expect(e.fase).toBe('vazia');
  });

  it('mede o intervalo entre partos a partir do segundo', () => {
    const um = estadoReprodutivo(vaca(), [ev('Parto', 400)]);
    expect(um.intervaloMedioPartos).toBeUndefined();

    const dois = estadoReprodutivo(vaca(), [ev('Parto', 800), ev('Parto', 410)]);
    expect(dois.intervaloMedioPartos).toBe(390);
  });
});

describe('preverParto', () => {
  it('usa a gestação média de cada espécie', () => {
    const base = isoDaysAgo(0);
    const dias = (iso: string) =>
      Math.round((new Date(iso).getTime() - new Date(base).getTime()) / 86_400_000);
    expect(dias(preverParto('Bovino', base))).toBe(283);
    expect(dias(preverParto('Ovino', base))).toBe(150);
    expect(dias(preverParto('Suíno', base))).toBe(114);
  });
});

describe('as três listas', () => {
  it('prestes a parir só traz as que caem dentro da janela', () => {
    const perto = vaca({ id: 'perto', dataPrevistaParto: isoInDays(10) });
    const longe = vaca({ id: 'longe', dataPrevistaParto: isoInDays(90) });
    const lista = prestesAParir([perto, longe], []);
    expect(lista.map((l) => l.animal.id)).toEqual(['perto']);
  });

  it('e inclui as que já passaram a data, à frente das outras', () => {
    // Uma previsão vencida é mais urgente, não menos: ou o parto aconteceu e
    // ninguém o registou, ou a vaca está com problemas.
    const atrasada = vaca({ id: 'atrasada', dataPrevistaParto: isoDaysAgo(5) });
    const proxima = vaca({ id: 'proxima', dataPrevistaParto: isoInDays(3) });
    const lista = prestesAParir([proxima, atrasada], []);
    expect(lista.map((l) => l.animal.id)).toEqual(['atrasada', 'proxima']);
  });

  it('aguardam diagnóstico junta as cobertas há muito e as duvidosas por repetir', () => {
    const coberta = vaca({ id: 'coberta' });
    const cedo = vaca({ id: 'cedo' });
    const duvidosa = vaca({ id: 'duvidosa' });
    const eventos: Evento[] = [
      { ...ev('Cobrição', 50), animalId: 'coberta', id: 'c1' },
      { ...ev('Cobrição', 10), animalId: 'cedo', id: 'c2' },
      { ...ev('Cobrição', 90), animalId: 'duvidosa', id: 'c3' },
      { ...ev('Diagnóstico', 30, { resultado: 'duvidoso' }), animalId: 'duvidosa', id: 'd1' },
    ];
    const ids = aguardamDiagnostico([coberta, cedo, duvidosa], eventos).map((l) => l.animal.id);
    expect(ids).toContain('coberta');
    expect(ids).toContain('duvidosa');
    expect(ids).not.toContain('cedo');
  });

  it('sem cobrição após o parto ignora quem nunca pariu', () => {
    // Uma novilha que nunca pariu também está vazia — mas o que ela precisa é
    // de entrar à reprodução, que é outra decisão e outra lista.
    const parida = vaca({ id: 'parida' });
    const novilha = vaca({ id: 'novilha' });
    const lista = semCobricaoAposParto(
      [parida, novilha],
      [{ ...ev('Parto', 150), animalId: 'parida', id: 'p1' }],
    );
    expect(lista.map((l) => l.animal.id)).toEqual(['parida']);
  });

  it('e ignora quem já voltou a ser coberta', () => {
    const lista = semCobricaoAposParto(
      [vaca()],
      [ev('Parto', 150), ev('Cobrição', 20)],
    );
    expect(lista).toHaveLength(0);
  });
});

describe('resumoReproducao', () => {
  it('conta as fases e calcula a taxa de gestação sobre as elegíveis', () => {
    const animais = [
      vaca({ id: 'g1' }),
      vaca({ id: 'g2' }),
      vaca({ id: 'v1' }),
      vaca({ id: 'v2' }),
      // Não elegíveis: não entram na conta de lado nenhum.
      vaca({ id: 'macho', sexo: 'Macho' }),
      vaca({ id: 'vitela', dataNascimento: isoDaysAgo(100) }),
    ];
    const eventos: Evento[] = [
      { ...ev('Diagnóstico', 30, { resultado: 'gestante' }), animalId: 'g1', id: 'd1' },
      { ...ev('Diagnóstico', 30, { resultado: 'gestante' }), animalId: 'g2', id: 'd2' },
    ];

    const r = resumoReproducao(animais, eventos);
    expect(r.elegiveis).toBe(4);
    expect(r.gestantes).toBe(2);
    expect(r.vazias).toBe(2);
    expect(r.taxaGestacao).toBe(50);
  });

  it('não inventa um intervalo entre partos sem dois partos em ninguém', () => {
    // Com um ano de registos ainda não há segundo parto em quase nenhuma vaca.
    // Uma média tirada de uma só é um número que parece medida e não é.
    expect(resumoReproducao([vaca()], [ev('Parto', 100)]).intervaloMedioPartos).toBeUndefined();
  });
});
