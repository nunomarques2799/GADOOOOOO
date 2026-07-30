/**
 * A apresentação de um separador, à primeira vez que se abre.
 *
 * O que interessa provar é o "à primeira vez": um cartão que voltasse a
 * aparecer a cada visita passava de ajuda a estorvo, e um que se marcasse como
 * visto sem ninguém o ter fechado deixava o separador por explicar para sempre.
 * A reposição pela Ajuda anda a par com a do guia do Início.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockKv = new Map<string, string>();

jest.mock('@/data/armazenamento', () => ({
  armazenamentoDisponivel: true,
  ler: (chave: string) => mockKv.get(chave) ?? null,
  guardar: (chave: string, valor: string) => void mockKv.set(chave, valor),
  remover: (chave: string) => void mockKv.delete(chave),
}));

import { CartaoIntroducao } from '../CartaoIntroducao';
import { introducaoVista, marcarIntroducaoVista, reporIntroducoes } from '@/data/introducoes';

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

function tocar(r: ReactTestRenderer, rotulo: string) {
  const no = r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.props.label === rotulo || n.props.accessibilityLabel === rotulo);
  if (!no) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  act(() => (no.props.onPress as () => void)());
}

function abrir(): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <CartaoIntroducao
        chave="trabalhadores"
        icon="account-hard-hat"
        titulo="Para que serve este separador"
        pontos={['Convida-se com um código.', 'Cada um só mexe no que lhe compete.']}
      />,
    );
  });
  return r;
}

describe('cartão de apresentação de um separador', () => {
  beforeEach(() => mockKv.clear());

  it('à primeira vez, explica o ecrã', () => {
    const t = textos(abrir());
    expect(t).toContain('Para que serve este separador');
    expect(t).toContain('Convida-se com um código.');
    expect(t).toContain('Cada um só mexe no que lhe compete.');
  });

  it('o "Percebi" fecha-o e não volta a aparecer', () => {
    const r = abrir();
    tocar(r, 'Percebi');
    expect(r.toJSON()).toBeNull();
    expect(introducaoVista('trabalhadores')).toBe(true);
    // Numa visita seguinte ao separador, já não ocupa o topo do ecrã.
    expect(abrir().toJSON()).toBeNull();
  });

  it('a Ajuda repõe as apresentações', () => {
    marcarIntroducaoVista('trabalhadores');
    reporIntroducoes();
    expect(introducaoVista('trabalhadores')).toBe(false);
    expect(textos(abrir())).toContain('Para que serve este separador');
  });
});
