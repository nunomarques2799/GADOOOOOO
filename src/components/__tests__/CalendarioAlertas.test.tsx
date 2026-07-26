/**
 * O calendário desenhado a sério, com React.
 *
 * As contas de dias já estão cobertas em `data/__tests__/calendario.test.ts`.
 * O que falta provar é a ligação entre elas e o ecrã: que o dia certo fica
 * marcado, que tocar num dia mostra o que lá está, e que um alerta sem dia
 * marcado não desaparece de vista. É onde um calendário costuma mentir — a
 * grelha parece bem e mostra o dia ao lado.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { CalendarioAlertas } from '../CalendarioAlertas';
import { chaveDia, MESES } from '@/data/calendario';
import type { Alerta } from '@/data/types';

function alerta(id: string, over: Partial<Alerta> = {}): Alerta {
  return {
    id,
    categoria: 'parto',
    gravidade: 'info',
    titulo: `Aviso ${id}`,
    descricao: `Descrição ${id}`,
    ...over,
  };
}

/** Todo o texto que o ecrã mostra, em bruto. */
function textos(r: ReactTestRenderer): string {
  const juntar = (no: unknown): string => {
    if (typeof no === 'string') return no;
    if (Array.isArray(no)) return no.map(juntar).join(' ');
    if (no && typeof no === 'object' && 'children' in no) {
      return juntar((no as { children: unknown }).children);
    }
    return '';
  };
  return juntar(r.toJSON());
}

/**
 * O primeiro nó tocável cujo rótulo contém este texto.
 *
 * Tem de exigir `onPress`: o mesmo rótulo aparece no Pressable e nas Views que
 * ele embrulha, e essas não têm com que responder ao toque.
 */
function tocavel(r: ReactTestRenderer, texto: string) {
  return r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        (n.props.accessibilityLabel as string).includes(texto),
    );
}

function tocar(r: ReactTestRenderer, texto: string) {
  const alvo = tocavel(r, texto);
  if (!alvo) throw new Error(`Não há nada tocável com "${texto}"`);
  act(() => {
    (alvo.props.onPress as () => void)();
  });
}

/** Data local a `n` dias de hoje, ao meio-dia (fora de saltos de fuso). */
function daquiA(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function render(alertas: Alerta[]): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<CalendarioAlertas alertas={alertas} />);
  });
  return r;
}

describe('CalendarioAlertas', () => {
  it('abre no mês de hoje', () => {
    const hoje = new Date();
    const t = textos(render([]));
    expect(t).toContain(MESES[hoje.getMonth()]);
    expect(t).toContain(String(hoje.getFullYear()));
  });

  it('abre com o dia de hoje escolhido e mostra o que lá está', () => {
    // O criador abre o calendário para saber o que tem para fazer HOJE. Abrir
    // no dia 1 do mês obrigava-o a procurar o dia certo antes de ver nada.
    const t = textos(render([alerta('hoje', { data: daquiA(0).toISOString() })]));
    expect(t).toContain('Hoje');
    expect(t).toContain('Aviso hoje');
  });

  it('um alerta de outro dia não aparece no dia de hoje', () => {
    const t = textos(render([alerta('amanha', { data: daquiA(1).toISOString() })]));
    expect(t).not.toContain('Aviso amanha');
    expect(t).toContain('Nada marcado para este dia.');
  });

  it('tocar num dia mostra os alertas desse dia', () => {
    const amanha = daquiA(1);
    const r = render([alerta('amanha', { data: amanha.toISOString() })]);

    // A descrição do dia inclui o número e o mês por extenso.
    tocar(r, `${amanha.getDate()} de ${MESES[amanha.getMonth()]}`);
    expect(textos(r)).toContain('Aviso amanha');
  });

  it('conta os alertas de cada dia na própria grelha', () => {
    const amanha = daquiA(1);
    const r = render([
      alerta('a', { data: amanha.toISOString() }),
      alerta('b', { data: amanha.toISOString() }),
    ]);
    const dia = r.root
      .findAll((n) => typeof n.props?.accessibilityLabel === 'string')
      .find((n) =>
        (n.props.accessibilityLabel as string).includes(
          `${amanha.getDate()} de ${MESES[amanha.getMonth()]}`,
        ),
      );
    expect(dia?.props.accessibilityLabel).toContain('2 avisos');
  });

  it('os alertas sem dia marcado são contados, não escondidos', () => {
    // Um animal sem nenhuma vacinação registada não tem prazo a correr, mas
    // continua a ser trabalho por fazer. Se o calendário simplesmente o
    // deitasse fora, quem trocasse a lista pelo calendário perdia-o de vista.
    const t = textos(render([alerta('sem-dia'), alerta('outro-sem-dia')]));
    expect(t).toContain('2 avisos sem dia marcado');
  });

  it('mudar de mês muda o título e não perde o botão de voltar a hoje', () => {
    const r = render([]);
    const hoje = new Date();

    tocar(r, 'Mês seguinte');

    const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    expect(textos(r)).toContain(MESES[proximo.getMonth()]);

    // Fora do mês de hoje aparece o atalho para voltar — sem ele, quem
    // avançasse seis meses tinha de carregar seis vezes para trás.
    expect(tocavel(r, 'Voltar ao mês de hoje')).toBeTruthy();

    tocar(r, 'Voltar ao mês de hoje');
    expect(textos(r)).toContain(MESES[hoje.getMonth()]);
    expect(textos(r)).toContain('Hoje');
  });

  it('o dia mais grave manda na marca do dia', () => {
    const amanha = daquiA(1);
    const r = render([
      alerta('leve', { data: amanha.toISOString(), gravidade: 'info' }),
      alerta('grave', { data: amanha.toISOString(), gravidade: 'urgente' }),
    ]);
    tocar(r, `${amanha.getDate()} de ${MESES[amanha.getMonth()]}`);
    const t = textos(r);
    expect(t).toContain('Aviso grave');
    expect(t).toContain('Aviso leve');
  });

  it('agrupa pelo dia local, não pelo dia de UTC', () => {
    // Um parto às 23:30 de hoje é, em UTC no verão, já amanhã. O calendário
    // tem de o pôr no dia em que o criador o vive.
    const tardinha = new Date();
    tardinha.setHours(23, 30, 0, 0);
    const r = render([alerta('noite', { data: tardinha.toISOString() })]);
    expect(chaveDia(tardinha)).toBe(chaveDia(new Date()));
    expect(textos(r)).toContain('Aviso noite');
  });
});
