import { describe, expect, it } from '@jest/globals';

import { comRelogio } from '../../testUtils/relogio';
import { diaIso, isoDaysAgo, isoInDays } from '../helpers';
import {
  estadoDoLote,
  formatQuantidade,
  lotesComEstado,
  lotesUtilizaveis,
  rotuloLote,
  tabelaExistencias,
} from '../medicamentos';
import type { Evento, Medicamento } from '../types';

function lote(over: Partial<Medicamento> = {}): Medicamento {
  return {
    id: 'm1',
    exploracaoId: 'exp-1',
    nome: 'Penicilina',
    tipo: 'Medicamento',
    lote: 'PN-1',
    quantidade: 100,
    unidade: 'ml',
    intervaloSegurancaDias: 10,
    dataCompra: diaIso(isoDaysAgo(30)),
    ...over,
  };
}

function usa(medicamentoId: string, quantidade: number, id = 'e1'): Evento {
  return {
    id,
    animalId: 'a1',
    tipo: 'Medicamento',
    data: isoDaysAgo(1),
    descricao: '',
    medicamentoId,
    quantidade,
  };
}

describe('estadoDoLote — o que resta', () => {
  it('é o que entrou menos o que os eventos gastaram', () => {
    const e = estadoDoLote(lote(), [usa('m1', 30), usa('m1', 12, 'e2')]);
    expect(e.usado).toBe(42);
    expect(e.resta).toBe(58);
    expect(e.esgotado).toBe(false);
  });

  it('ignora eventos de outros lotes e eventos sem quantidade', () => {
    // Um tratamento sem quantidade é o do veterinário que trouxe o seu frasco:
    // contá-lo como zero é o mesmo que ignorá-lo, mas contá-lo como o frasco
    // todo seria zerar o stock sem razão.
    const e = estadoDoLote(lote(), [usa('m2', 50, 'e2'), { ...usa('m1', 0, 'e3'), quantidade: undefined }]);
    expect(e.usado).toBe(0);
    expect(e.resta).toBe(100);
  });

  it('nunca mostra negativo, mesmo com um erro de digitação', () => {
    // Escrever 200 em vez de 20 acontece. "−100 ml" no ecrã não ajuda ninguém a
    // perceber que se enganou; o disparate fica à vista no `usado`.
    const e = estadoDoLote(lote(), [usa('m1', 200)]);
    expect(e.resta).toBe(0);
    expect(e.usado).toBe(200);
    expect(e.esgotado).toBe(true);
  });

  it('avisa quando está a acabar', () => {
    expect(estadoDoLote(lote(), [usa('m1', 90)]).quaseVazio).toBe(true);
    expect(estadoDoLote(lote(), [usa('m1', 50)]).quaseVazio).toBe(false);
  });
});

describe('estadoDoLote — validade', () => {
  it('um frasco válido "até hoje" ainda se pode usar', () => {
    // A leitura da bula: válido até 31 de agosto quer dizer que no dia 31 se
    // usa. Um `<= 0` dava o frasco por estragado um dia inteiro antes de tempo.
    const e = estadoDoLote(lote({ validade: diaIso(new Date()) }), []);
    expect(e.expirado).toBe(false);
    expect(e.disponivel).toBe(true);
  });

  it('e no dia seguinte já não', () => {
    const e = estadoDoLote(lote({ validade: diaIso(isoDaysAgo(1)) }), []);
    expect(e.expirado).toBe(true);
    expect(e.disponivel).toBe(false);
  });

  it('e continua a ser o dia seguinte à 00:30 de verão', () => {
    // O erro que isto fecha durava uma hora por dia, de março a outubro: a
    // validade é gravada SEM hora (`diaIso`), o JS lia-a como meia-noite UTC e
    // à 00:30 de Portugal em UTC+1 o frasco de ONTEM ficava a 0,98 dias de
    // agora — perto o suficiente para passar por HOJE. O lote fora de validade
    // aparecia como "A expirar" e continuava a poder escolher-se para um
    // tratamento, que é o oposto do que estas duas linhas existem para garantir.
    //
    // Com a hora real isto passava sozinho 23 horas por dia. E em UTC passava
    // as 24, porque aí a meia-noite UTC é a meia-noite local e não há
    // desalinhamento nenhum — daí a suite correr fixada em hora de Portugal
    // (`jest.config.js`), que é onde a app é usada.
    comRelogio([2026, 8, 6, 0, 30], () => {
      const ontem = estadoDoLote(lote({ validade: '2026-08-05' }), []);
      expect(ontem.diasParaValidade).toBe(-1);
      expect(ontem.expirado).toBe(true);
      expect(ontem.disponivel).toBe(false);

      const hoje = estadoDoLote(lote({ validade: '2026-08-06' }), []);
      expect(hoje.diasParaValidade).toBe(0);
      expect(hoje.expirado).toBe(false);
      expect(hoje.disponivel).toBe(true);
    });
  });

  it('sem validade escrita não expira nunca', () => {
    const e = estadoDoLote(lote({ validade: undefined }), []);
    expect(e.expirado).toBe(false);
    expect(e.diasParaValidade).toBeUndefined();
  });

  it('marca "a expirar" dentro do mês', () => {
    expect(estadoDoLote(lote({ validade: diaIso(isoInDays(20)) }), []).aExpirar).toBe(true);
    expect(estadoDoLote(lote({ validade: diaIso(isoInDays(200)) }), []).aExpirar).toBe(false);
  });
});

describe('lotesComEstado — a ordem da lista', () => {
  it('põe o que se pode usar primeiro, e dentro disso o que expira antes', () => {
    // É essa a ordem em que se deve gastar: o que está mais perto do fim
    // primeiro, para não se estragar na prateleira.
    const lotes = [
      lote({ id: 'longe', validade: diaIso(isoInDays(300)) }),
      lote({ id: 'expirado', validade: diaIso(isoDaysAgo(10)) }),
      lote({ id: 'perto', validade: diaIso(isoInDays(10)) }),
      lote({ id: 'sem-validade', validade: undefined }),
    ];
    const ordem = lotesComEstado(lotes, []).map((l) => l.medicamento.id);
    expect(ordem).toEqual(['perto', 'longe', 'sem-validade', 'expirado']);
  });

  it('dá o mesmo resultado que o cálculo lote a lote', () => {
    // São dois caminhos (um varre os eventos uma vez, o outro por lote) e têm
    // de concordar: se divergirem, o ecrã e o alerta dizem números diferentes.
    const l = lote();
    const eventos = [usa('m1', 30), usa('m1', 20, 'e2')];
    expect(lotesComEstado([l], eventos)[0]).toEqual(estadoDoLote(l, eventos));
  });
});

describe('lotesUtilizaveis — o que aparece no formulário do tratamento', () => {
  const lotes = [
    lote({ id: 'bom' }),
    lote({ id: 'vacina', tipo: 'Vacina' }),
    lote({ id: 'expirado', validade: diaIso(isoDaysAgo(1)) }),
    lote({ id: 'outra-exp', exploracaoId: 'exp-2' }),
  ];

  it('só o tipo certo, desta exploração, com stock e dentro da validade', () => {
    const ids = lotesUtilizaveis(lotes, [], 'exp-1', 'Medicamento').map((l) => l.medicamento.id);
    expect(ids).toEqual(['bom']);
  });

  it('esconde o esgotado', () => {
    const ids = lotesUtilizaveis(lotes, [usa('bom', 100)], 'exp-1', 'Medicamento').map(
      (l) => l.medicamento.id,
    );
    expect(ids).toEqual([]);
  });

  it('sem exploração escolhida não oferece nada', () => {
    // O formulário abre sem animal escolhido, e portanto sem exploração. Uma
    // lista de frascos de outra quinta seria pior do que nenhuma.
    expect(lotesUtilizaveis(lotes, [], undefined, 'Medicamento')).toEqual([]);
  });
});

describe('rótulos', () => {
  it('a quantidade sai à portuguesa', () => {
    expect(formatQuantidade(20, 'ml')).toBe('20 ml');
    expect(formatQuantidade(1.5, 'l')).toBe('1,5 l');
  });

  it('o lote distingue dois frascos do mesmo produto', () => {
    expect(rotuloLote(lote())).toBe('Penicilina (lote PN-1)');
    expect(rotuloLote(lote({ lote: undefined }))).toBe('Penicilina');
  });
});

describe('tabelaExistencias', () => {
  it('escreve o estado por extenso, para a folha se ler sem cores', () => {
    const linhas = tabelaExistencias(
      lotesComEstado(
        [lote({ id: 'a' }), lote({ id: 'b', validade: diaIso(isoDaysAgo(1)) })],
        [usa('a', 90)],
      ),
    ).linhas;
    const estados = linhas.map((l) => l[l.length - 1]);
    expect(estados).toContain('A acabar');
    expect(estados).toContain('Fora de validade');
  });
});
