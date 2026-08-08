import { describe, expect, it } from '@jest/globals';

import { comRelogio } from '../../testUtils/relogio';
import { isoDaysAgo, isoInDays } from '../helpers';
import {
  aguardamDiagnostico,
  elegivelParaReproducao,
  estadoReprodutivo,
  nomeNaCobricao,
  porFase,
  prestesAParir,
  preverParto,
  resumoReproducao,
  semCobricaoAposParto,
  sugestoesDeCobricao,
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

describe('as contas de dias do ciclo não mudam a meio do dia', () => {
  // Os eventos ficam gravados ao MEIO-DIA — é o que o `parseDataPt` do
  // formulário escreve. Enquanto o `diasDesde` e o `diasEntre` mediam a
  // distância em horas e arredondavam para baixo, a fração até ao meio-dia
  // tirava um dia: "pariu há 12 dias" lia-se 11 de manhã e 12 de tarde, sem
  // nada ter acontecido pelo meio, e o alerta de "sem cobrição desde o parto"
  // atrasava-se um dia a disparar.
  const aoMeioDiaDe = (ano: number, mes: number, dia: number) =>
    new Date(ano, mes - 1, dia, 12, 0, 0).toISOString();

  it.each([0, 6, 9, 11, 12, 13, 18, 23])('às %ih', (hora) => {
    comRelogio([2026, 8, 8, hora, 30], () => {
      const parto = ev('Parto', 0, { data: aoMeioDiaDe(2026, 7, 27) }); // há 12 dias
      const e = estadoReprodutivo(vaca(), [parto]);
      expect(e.diasDesdeUltimoParto).toBe(12);
      expect(e.diasNaFase).toBe(12);
    });
  });

  it('e a cobrição de ontem conta um dia, não zero', () => {
    comRelogio([2026, 8, 8, 9, 0], () => {
      const e = estadoReprodutivo(vaca(), [ev('Cobrição', 0, { data: aoMeioDiaDe(2026, 8, 7) })]);
      expect(e.fase).toBe('coberta');
      expect(e.diasNaFase).toBe(1);
    });
  });

  it('o intervalo entre partos aguenta a noite de 23 horas', () => {
    // Este não depende da hora a que se pergunta — é a distância entre dois
    // partos —, depende da ESTAÇÃO. De janeiro a junho há a noite em que o
    // relógio avança: 151 dias de calendário passam em 151 dias menos uma hora
    // de tempo real, e arredondar para baixo dava 150. Um dia a menos no número
    // que mede se a vaca está a perder ciclos.
    comRelogio([2026, 8, 8, 9, 0], () => {
      const dois = estadoReprodutivo(vaca(), [
        ev('Parto', 800, { data: aoMeioDiaDe(2026, 1, 4) }),
        ev('Parto', 410, { data: aoMeioDiaDe(2026, 6, 4) }),
      ]);
      expect(dois.intervaloMedioPartos).toBe(151);
    });
  });
});

describe('preverParto', () => {
  it('usa a gestação média de cada espécie', () => {
    // O relógio é fixo num dia de verão de propósito: 150 e 114 dias depois de
    // agosto caem depois da mudança da hora de outubro, e é essa travessia que
    // este teste tem de aguentar. Com a data real, o caso só era exercido em
    // parte do ano.
    comRelogio([2026, 8, 6, 0, 33], () => {
      const base = isoDaysAgo(0);
      // Os dois lados ancorados ao meio-dia antes de subtrair. Dividir a
      // diferença bruta por 86 400 000 conta 151 dias numa gestação de 150 que
      // atravesse a noite em que o relógio recua: essa noite tem 25 horas, e a
      // conta lia a hora a mais como meio dia a mais. É `isoMaisDias` que está
      // certo — soma dias de calendário —, era a medição que estava a mentir.
      const aoMeioDia = (iso: string) => new Date(iso).setHours(12, 0, 0, 0);
      const dias = (iso: string) =>
        Math.round((aoMeioDia(iso) - aoMeioDia(base)) / 86_400_000);
      expect(dias(preverParto('Bovino', base))).toBe(283);
      expect(dias(preverParto('Ovino', base))).toBe(150);
      expect(dias(preverParto('Suíno', base))).toBe(114);
    });
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

describe('sugestoesDeCobricao — o que se pode escolher sem escrever', () => {
  const touro = (over: Partial<Animal> = {}): Animal =>
    vaca({
      id: `m-${over.nome ?? over.numeroIdentificacao ?? 'x'}`,
      sexo: 'Macho',
      dataNascimento: isoDaysAgo(365 * 4),
      ...over,
    });

  it('oferece os machos adultos do efetivo, com os sementais à frente', () => {
    const machos = [
      touro({ nome: 'Boieiro', finalidade: 'Carne' }),
      touro({ nome: 'Marquês', finalidade: 'Semental' }),
    ];
    expect(sugestoesDeCobricao(machos, [], 'exp-1', 'Touro')).toEqual(['Marquês', 'Boieiro']);
  });

  it('deixa de fora as fêmeas, os vitelos e quem já saiu do efetivo', () => {
    const lista = [
      vaca({ id: 'f', nome: 'Amora' }),
      touro({ nome: 'Vitelo', dataNascimento: isoDaysAgo(60) }),
      touro({ nome: 'Vendido', estado: 'vendido' }),
      touro({ nome: 'Marquês' }),
    ];
    expect(sugestoesDeCobricao(lista, [], 'exp-1', 'Touro')).toEqual(['Marquês']);
  });

  it('e os machos de outra exploração — o touro está fisicamente numa quinta só', () => {
    const machos = [touro({ nome: 'Daqui' }), touro({ nome: 'Dali', exploracaoId: 'exp-2' })];
    expect(sugestoesDeCobricao(machos, [], 'exp-1', 'Touro')).toEqual(['Daqui']);
  });

  /**
   * É esta a metade que apanha o touro do vizinho: ele nunca esteve no efetivo,
   * e sem isto quem o usa todos os anos escreve-lhe o nome à mão todos os anos.
   */
  it('junta os nomes já escritos em cobrições anteriores, do mais recente primeiro', () => {
    const eventos = [
      ev('Cobrição', 200, { detalhe: 'Touro: Velho' }),
      ev('Cobrição', 10, { detalhe: 'Touro: Recente' }),
    ];
    expect(sugestoesDeCobricao([], eventos, 'exp-1', 'Touro')).toEqual(['Recente', 'Velho']);
  });

  it('não repete o mesmo touro por causa de uma maiúscula', () => {
    // "Marquês" e "marquês" são o mesmo animal. Oferecer os dois é oferecer a
    // maneira de ficar com dois touros no histórico onde só há um.
    const eventos = [ev('Cobrição', 10, { detalhe: 'Touro: marquês' })];
    const sugestoes = sugestoesDeCobricao([touro({ nome: 'Marquês' })], eventos, 'exp-1', 'Touro');
    expect(sugestoes).toEqual(['Marquês']);
  });

  it('na inseminação oferece as palhetas e nenhum macho do curral', () => {
    // O que se escreve numa inseminação é a palheta. Um macho do efetivo ali é
    // uma sugestão errada — e uma que fica a mentir na genealogia da cria.
    const eventos = [ev('Cobrição', 10, { detalhe: 'Sémen: Alentejano 4471' })];
    const sugestoes = sugestoesDeCobricao([touro({ nome: 'Marquês' })], eventos, 'exp-1', 'Sémen');
    expect(sugestoes).toEqual(['Alentejano 4471']);
  });

  it('lê o nome no meio dos outros pedaços do detalhe', () => {
    // O `detalhe` é um punhado de pedaços colados por " · ".
    const e = ev('Cobrição', 5, { detalhe: 'Touro: Marquês · nota qualquer' });
    expect(nomeNaCobricao(e, 'Touro')).toBe('Marquês');
    expect(nomeNaCobricao(ev('Cobrição', 5), 'Touro')).toBeUndefined();
  });
});

describe('porFase — quem são os números do resumo', () => {
  it('traz as cobertas e as duvidosas juntas, a mais recente primeiro', () => {
    const coberta = vaca({ id: 'nova', nome: 'Nova' });
    const antiga = vaca({ id: 'antiga', nome: 'Antiga' });
    const linhas = porFase(
      [coberta, antiga],
      [
        { ...ev('Cobrição', 3), animalId: 'nova' },
        { ...ev('Cobrição', 40), animalId: 'antiga' },
      ],
      ['coberta', 'duvidosa'],
    );
    expect(linhas.map((l) => l.animal.nome)).toEqual(['Nova', 'Antiga']);
  });

  it('e não traz quem está noutra fase', () => {
    // Uma vaca que pariu está vazia, não coberta. Misturá-las dava uma lista de
    // "cobertas" com metade do efetivo lá dentro.
    const linhas = porFase([vaca()], [ev('Parto', 10)], ['coberta', 'duvidosa']);
    expect(linhas).toEqual([]);
  });
});
