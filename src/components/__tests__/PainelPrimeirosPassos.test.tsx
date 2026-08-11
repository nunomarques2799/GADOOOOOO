/**
 * O guia de primeiros passos, no ecrã.
 *
 * Que passos existem e quais contam para o progresso está provado em
 * `data/__tests__/tutorial.test.ts`. O que falta é o painel: que explica cada
 * passo por extenso (a queixa era ser demasiado seco), que só abre UM de cada
 * vez, que a explicação traz consigo a porta para lá ir, e que os feitios
 * opcionais ficam à parte — visíveis, mas sem prender o guia a quem não os
 * quer.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Animal, Exploracao, Terreno } from '@/data/types';

const mockKv = new Map<string, string>();

const mockDados = {
  exploracoes: [] as Exploracao[],
  terrenos: [] as Terreno[],
  animais: [] as Animal[],
};

const mockNotif = { preferencias: { noTelemovel: false } };
const mockPlataforma = { suportaNotificacoes: false };
const mockAcesso = { podeEmAlguma: (_c: string) => true };
const mockRotas: string[] = [];

jest.mock('expo-router', () => {
  const router = { push: (destino: string) => mockRotas.push(destino) };
  return { useRouter: () => router };
});
jest.mock('@/data/armazenamento', () => ({
  armazenamentoDisponivel: true,
  ler: (chave: string) => mockKv.get(chave) ?? null,
  guardar: (chave: string, valor: string) => void mockKv.set(chave, valor),
  remover: (chave: string) => void mockKv.delete(chave),
}));
jest.mock('@/data/store', () => ({ useGado: () => mockDados }));
jest.mock('@/data/notificacoes', () => ({ useNotificacoes: () => mockNotif }));
jest.mock('@/data/notificacoesLocais', () => ({
  get suportaNotificacoes() {
    return mockPlataforma.suportaNotificacoes;
  },
  temPermissao: () => Promise.resolve(false),
}));
jest.mock('@/data/membros', () => ({ useMembros: () => mockAcesso }));

import { PainelPrimeirosPassos } from '../PainelPrimeirosPassos';

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

function tocaveis(r: ReactTestRenderer): string[] {
  return r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .map((n) => String(n.props.label ?? n.props.accessibilityLabel ?? ''));
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
    r = create(<PainelPrimeirosPassos />);
  });
  return r;
}

describe('painel de primeiros passos', () => {
  beforeEach(() => {
    mockKv.clear();
    mockDados.exploracoes = [];
    mockDados.terrenos = [];
    mockDados.animais = [];
    mockNotif.preferencias.noTelemovel = false;
    mockPlataforma.suportaNotificacoes = false;
    mockAcesso.podeEmAlguma = () => true;
    mockRotas.length = 0;
  });

  it('numa conta nova, lista o caminho todo e conta só o essencial', () => {
    const t = textos(abrir());
    // O número vem num nó de texto próprio, daí os espaços.
    expect(t).toMatch(/0\s+de\s+3\s+feito/);
    expect(t).toContain('Criar a sua exploração');
    expect(t).toContain('Registar os seus terrenos');
    expect(t).toContain('Registar o primeiro animal');
  });

  it('abre sozinho o passo seguinte, explicado e com a porta para lá ir', () => {
    const r = abrir();
    // A explicação por extenso do primeiro passo, e só dele.
    expect(textos(r)).toContain('é dentro dela que ficam os terrenos');
    expect(tocaveis(r)).toContain('Criar a exploração');
    tocar(r, 'Criar a exploração');
    expect(mockRotas).toEqual(['/exploracao/nova']);
  });

  it('tocar noutro passo troca a explicação em vez de as somar', () => {
    // Seis explicações abertas ao mesmo tempo eram um muro de texto em cima do
    // Início — que é o oposto de um guia.
    const r = abrir();
    tocar(r, 'Registar os seus terrenos. As pastagens, os cercados e os currais onde o gado anda.');
    const t = textos(r);
    expect(t).toContain('Um terreno é cada sítio onde os animais podem estar');
    expect(t).not.toContain('é dentro dela que ficam os terrenos');
  });

  it('o passo já cumprido risca-se e deixa de se abrir', () => {
    mockDados.exploracoes = [{ id: 'e1', nome: 'Monte do Avô' } as Exploracao];
    const r = abrir();
    expect(textos(r)).toMatch(/1\s+de\s+3\s+feito/);
    // Agora o passo apontado é o dos terrenos, aberto sozinho.
    expect(textos(r)).toContain('Um terreno é cada sítio onde os animais podem estar');
    expect(tocaveis(r)).not.toContain('Criar a exploração');
  });

  it('os opcionais ficam à parte e não entram na conta', () => {
    const r = abrir();
    const t = textos(r);
    expect(t).toContain('SE QUISER, NÃO É PRECISO');
    expect(t).toContain('Ligar a gestão do dinheiro');
    // Continua a contar 3: os feitios à escolha não fazem o guia crescer.
    // O número vem num nó de texto próprio, daí os espaços.
    expect(t).toMatch(/0\s+de\s+3\s+feito/);
  });

  it('um opcional explica-se e leva ao ecrã que o liga', () => {
    const r = abrir();
    tocar(r, 'Ligar a gestão do dinheiro. Só se quiser apontar despesas e vendas na app.');
    expect(textos(r)).toContain('desligar esconde, não apaga');
    tocar(r, 'Ver a gestão do dinheiro');
    expect(mockRotas).toEqual(['/conta/financas']);
  });

  it('a quem não é dono, não mostra os interruptores da conta', () => {
    mockAcesso.podeEmAlguma = () => false;
    expect(textos(abrir())).not.toContain('SE QUISER — NÃO É PRECISO');
  });

  it('no telemóvel acrescenta o passo dos avisos', () => {
    mockPlataforma.suportaNotificacoes = true;
    expect(textos(abrir())).toMatch(/0\s+de\s+4\s+feito/);
  });

  it('esconder faz o painel sumir e fica guardado', () => {
    const r = abrir();
    tocar(r, 'Esconder o guia de primeiros passos');
    expect(r.toJSON()).toBeNull();
    expect(textos(abrir())).toEqual('');
  });

  it('com o caminho andado, sai do Início mesmo com opcionais por ligar', () => {
    mockDados.exploracoes = [{ id: 'e1', nome: 'Monte do Avô' } as Exploracao];
    mockDados.terrenos = [{ id: 't1', nome: 'Courela', exploracaoId: 'e1' } as Terreno];
    mockDados.animais = [{ id: 'a1', exploracaoId: 'e1' } as Animal];
    expect(abrir().toJSON()).toBeNull();
  });
});
