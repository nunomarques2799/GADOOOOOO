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
import {
  destinoDoAviso,
  HORA_AVISO,
  HORIZONTE_DIAS,
  MAX_AGENDADAS,
  MINUTOS_AVISO_ACESSO,
  orcamentoParaAlertas,
  planear,
  planearFimDeAcesso,
  quandoTocar,
  TETO_IOS,
  textoDoAviso,
} from '../notificacoesPlano';
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

  it('corta pelo limite do sistema, deixando passar os dias mais próximos', () => {
    // O iOS guarda 64 pendentes e descarta o resto em silêncio. Se o corte
    // fosse pela ordem de chegada, um efetivo grande podia empurrar para fora
    // precisamente o prazo que está a vencer. Um alerta por dia, para que cada
    // um caia no seu — é o corte de DIAS que se mede aqui.
    const muitos = Array.from({ length: MAX_AGENDADAS + 20 }, (_, i) =>
      alerta(`a${i}`, { diasRestantes: 21 + i }),
    );

    const plano = planear([...muitos].reverse(), PREF_OMISSAO, AGORA);

    expect(plano).toHaveLength(MAX_AGENDADAS);
    const datas = plano.map((p) => p.quando.getTime());
    expect([...datas].sort((a, b) => a - b)).toEqual(datas); // por ordem
    expect(plano[0].alertas[0].id).toBe('a0'); // o mais próximo sobrevive
  });

  it('respeita o orçamento quando os avisos de acesso ocupam lugar', () => {
    const muitos = Array.from({ length: MAX_AGENDADAS + 20 }, (_, i) =>
      alerta(`a${i}`, { diasRestantes: 21 + i }),
    );
    const plano = planear(muitos, PREF_OMISSAO, AGORA, 12);
    expect(plano).toHaveLength(12);
    expect(plano[0].alertas[0].id).toBe('a0');
  });

  /**
   * O caso que motivou a mudança de 2026-09-02: numa exploração com trinta
   * animais, todos os prazos já dentro da janela caíam no MESMO instante (as 8
   * da manhã do dia seguinte) e o telemóvel dava dezenas de apitos seguidos.
   * Um aviso que se dispensa em bloco não avisa de nada.
   */
  it('junta num só aviso tudo o que cai no mesmo dia', () => {
    const doMesmoDia = Array.from({ length: 30 }, (_, i) =>
      alerta(`a${i}`, { diasRestantes: 3 }),
    );
    const plano = planear(doMesmoDia, PREF_OMISSAO, AGORA);

    expect(plano).toHaveLength(1);
    expect(plano[0].alertas).toHaveLength(30);
  });

  it('mantém dias diferentes em avisos diferentes', () => {
    const plano = planear(
      [alerta('hoje', { diasRestantes: 3 }), alerta('daqui-a-10', { diasRestantes: 30 })],
      PREF_OMISSAO,
      AGORA,
    );
    expect(plano).toHaveLength(2);
    expect(plano[0].alertas[0].id).toBe('hoje');
    expect(plano[1].alertas[0].id).toBe('daqui-a-10');
  });

  it('dentro do dia, o que falta menos tempo vem primeiro', () => {
    // É esse que dá o nome ao aviso quando ele é só um, e é a primeira linha
    // do corpo quando são vários.
    const plano = planear(
      [
        alerta('folgado', { diasRestantes: 3 }),
        alerta('urgente', { diasRestantes: 1 }),
      ],
      PREF_OMISSAO,
      AGORA,
    );
    expect(plano[0].alertas.map((a) => a.id)).toEqual(['urgente', 'folgado']);
  });
});

describe('textoDoAviso', () => {
  it('com um alerta só, o aviso É o alerta e leva à ficha do animal', () => {
    // Dizer "1 aviso para hoje" e esconder qual é seria trabalho a mais para
    // quem lê e informação a menos.
    const [dia] = planear([alerta('x', { diasRestantes: 3 })], PREF_OMISSAO, AGORA);
    const texto = textoDoAviso(dia);
    expect(texto.titulo).toBe(dia.alertas[0].titulo);
    expect(texto.corpo).toBe(dia.alertas[0].descricao);
    expect(texto.animalId).toBe(dia.alertas[0].animalId);
  });

  it('com vários, conta-os e diz os primeiros nomes', () => {
    const cinco = Array.from({ length: 5 }, (_, i) =>
      alerta(`a${i}`, { diasRestantes: 3, titulo: `Alerta ${i}` }),
    );
    const [dia] = planear(cinco, PREF_OMISSAO, AGORA);
    const texto = textoDoAviso(dia);

    expect(texto.titulo).toContain('5');
    expect(texto.corpo).toContain('Alerta 0');
    // Três nomes e o resto contado: o corpo não pode crescer com o efetivo.
    expect(texto.corpo).toContain('2');
    expect(texto.corpo).not.toContain('Alerta 4');
    // Sem ficha para onde ir — o toque abre a lista de alertas.
    expect(texto.animalId).toBeUndefined();
  });
});

describe('orcamentoParaAlertas', () => {
  /**
   * O caso que motivou isto: cinco vínculos com prazo a correr dão 15 avisos de
   * acesso, e 15 + 50 = 65 passa o teto de 64. O iOS descarta o excedente em
   * silêncio — não há erro, nem aviso, nem forma de dar por isso a não ser
   * reparar que um prazo não tocou.
   */
  it('mantém o total dentro do teto do iOS com muitos acessos', () => {
    const avisosDeAcesso = 5 * MINUTOS_AVISO_ACESSO.length;
    expect(avisosDeAcesso + MAX_AGENDADAS).toBeGreaterThan(TETO_IOS); // era o erro
    expect(avisosDeAcesso + orcamentoParaAlertas(avisosDeAcesso)).toBeLessThanOrEqual(TETO_IOS);
  });

  it('não encolhe os prazos quando há espaço de sobra', () => {
    expect(orcamentoParaAlertas(0)).toBe(MAX_AGENDADAS);
    expect(orcamentoParaAlertas(3)).toBe(MAX_AGENDADAS);
  });

  it('nunca devolve um orçamento negativo', () => {
    // Um número absurdo de acessos não pode fazer o `slice` cortar pelo fim.
    expect(orcamentoParaAlertas(500)).toBe(0);
  });
});

describe('destinoDoAviso', () => {
  const existe = (id: string) => id === 'a1';

  it('abre a ficha do animal do aviso', () => {
    expect(destinoDoAviso({ animalId: 'a1' }, existe)).toBe('/animal/a1');
  });

  it('vai para os alertas quando o aviso não é de um animal', () => {
    expect(destinoDoAviso({}, existe)).toBe('/alertas');
  });

  it('vai para os alertas quando o animal já não existe', () => {
    // Vendido e eliminado noutro aparelho, ou um aviso agendado por uma conta
    // anterior. Sem esta guarda o toque abria uma ficha "Animal não
    // encontrado" — e quem só queria saber o que fazer hoje ficava sem nada.
    expect(destinoDoAviso({ animalId: 'desaparecido' }, existe)).toBe('/alertas');
  });
});

/* ================================================================== *
 *  O acesso a acabar
 * ================================================================== */

describe('planearFimDeAcesso', () => {
  /** Um vínculo que acaba daqui a `minutos`. */
  function acesso(minutos: number, nome = 'Monte do Avô') {
    return {
      membroId: 'm1',
      nomeExploracao: nome,
      expiraEm: new Date(AGORA.getTime() + minutos * 60_000).toISOString(),
    };
  }

  it('marca os três avisos, do mais distante para o mais próximo', () => {
    const avisos = planearFimDeAcesso([acesso(120)], AGORA);
    expect(avisos.map((a) => a.minutosAntes)).toEqual([30, 15, 5]);
    // E cada um à hora certa: 120 min de prazo menos os minutos de antecedência.
    for (const a of avisos) {
      const faltam = Math.round((a.quando.getTime() - AGORA.getTime()) / 60_000);
      expect(faltam).toBe(120 - a.minutosAntes);
    }
  });

  it('não agenda no passado', () => {
    // A 10 minutos do fim, os avisos de 30 e de 15 já passaram. Agendá-los
    // fazia o sistema dispará-los de imediato — a app a apitar duas vezes mal
    // se abre, a dizer que falta meia hora para uma coisa daqui a dez minutos.
    const avisos = planearFimDeAcesso([acesso(10)], AGORA);
    expect(avisos.map((a) => a.minutosAntes)).toEqual([5]);
  });

  it('um acesso já terminado não gera aviso nenhum', () => {
    expect(planearFimDeAcesso([acesso(-30)], AGORA)).toEqual([]);
  });

  it('um vínculo sem prazo não gera aviso nenhum', () => {
    // É o caso do dono e do trabalhador: nunca expiram, e um aviso de fim de
    // acesso para quem não tem fim seria mentira.
    expect(
      planearFimDeAcesso([{ membroId: 'm1', nomeExploracao: 'X', expiraEm: undefined }], AGORA),
    ).toEqual([]);
  });

  it('uma data que não se lê é ignorada em vez de rebentar', () => {
    // Mesmo lado seguro do `acessoTerminou`: perante lixo, não se inventa um
    // aviso nem se deita o agendamento todo abaixo.
    expect(
      planearFimDeAcesso([{ membroId: 'm1', nomeExploracao: 'X', expiraEm: 'ontem' }], AGORA),
    ).toEqual([]);
  });

  it('com duas explorações, ordena pelo que acaba primeiro', () => {
    const avisos = planearFimDeAcesso(
      [
        { ...acesso(600, 'Longe'), membroId: 'longe' },
        { ...acesso(60, 'Perto'), membroId: 'perto' },
      ],
      AGORA,
    );
    // O primeiro a tocar tem de ser o da exploração que fecha primeiro: é ele
    // que ainda dá para salvar.
    expect(avisos[0].membroId).toBe('perto');
    expect(avisos).toHaveLength(MINUTOS_AVISO_ACESSO.length * 2);
  });

  it('diz o nome da exploração e o que fazer', () => {
    const [primeiro] = planearFimDeAcesso([acesso(120, 'Herdade das Corgas')], AGORA);
    expect(primeiro.titulo).toContain('Herdade das Corgas');
    expect(primeiro.titulo).toContain('30 minutos');
    // O de 5 minutos manda GRAVAR; os outros explicam o que se perde.
    const ultimo = planearFimDeAcesso([acesso(120)], AGORA).at(-1)!;
    expect(ultimo.corpo).toMatch(/[Gg]rave/);
  });
});
