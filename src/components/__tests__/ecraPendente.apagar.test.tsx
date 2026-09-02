/**
 * Apagar a conta a partir do ecrã de acesso.
 *
 * PORQUE É QUE ISTO TEM UM TESTE SÓ PARA SI
 *
 * A diretriz 5.1.1(v) da Apple obriga quem deixa criar conta a deixar apagá-la
 * de dentro da app. O ecrã que faz isso (`conta/apagar`) vive dentro dos
 * separadores, e quem ainda não tem exploração nenhuma NÃO TEM separadores: o
 * `AppRouter` do `_layout.tsx` monta o `EcraPendente` em vez da app inteira
 * enquanto `membros.length === 0`.
 *
 * Resultado, até 2026-08-24: quem se registava ficava com uma conta que só
 * sabia terminar sessão. Foi o criador a dar por isso a usar a app, não os
 * testes nem o `tsc` (é código correto que não faz uma coisa que devia fazer),
 * e é exatamente o estado onde o revisor da Apple cai se criar uma conta.
 *
 * E não é só o "pendente": uma conta JÁ APROVADA que ainda não criou
 * exploração cai no mesmo ecrã. O último teste deste ficheiro fixa isso.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/** Tudo o que os mocks devolvem. Mutável: cada teste põe cá o seu cenário. */
const mockEstado = {
  estadoPerfil: 'pendente' as 'pendente' | 'ativo',
  apagarConta: jest.fn<() => Promise<string | null>>(),
  saiu: 0,
  /** As perguntas finais que o ecrã fez, por responder. */
  confirmacoes: [] as { titulo: string; mensagem: string; aoConfirmar: () => void }[],
  avisos: [] as { titulo: string; mensagem: string }[],
};

// As fábricas só podem devolver funções que leem o `mockEstado` quando forem
// CHAMADAS: uma fábrica corre antes de as constantes do teste existirem (ver
// `gado-jest-mocks-e-import-dinamico`). Nada aqui toca no estado à cabeça.
jest.mock('@/data/auth', () => ({
  useAuth: () => ({
    utilizador: { email: 'novo@exemplo.pt', user_metadata: { nome: 'Zé Novo' } },
    apagarConta: mockEstado.apagarConta,
    sair: () => {
      mockEstado.saiu += 1;
    },
  }),
}));

jest.mock('@/data/membros', () => ({
  useMembros: () => ({
    recarregar: () => Promise.resolve(),
    aCarregar: false,
    estadoPerfil: mockEstado.estadoPerfil,
    resgatarConvite: () => Promise.resolve(null),
  }),
}));

jest.mock('@/data/avisos', () => ({
  confirmar: (titulo: string, mensagem: string, aoConfirmar: () => void) =>
    void mockEstado.confirmacoes.push({ titulo, mensagem, aoConfirmar }),
  avisar: (titulo: string, mensagem: string) => void mockEstado.avisos.push({ titulo, mensagem }),
}));

jest.mock('@/data/supabase', () => ({ supabase: null }));
jest.mock('@/hooks/useDesktop', () => ({ useDesktop: () => false }));

import { EcraPendente } from '../EcraPendente';

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function textos(r: ReactTestRenderer): string {
  const juntar = (no: unknown): string => {
    if (typeof no === 'string') return no;
    if (Array.isArray(no)) return no.map(juntar).join(' ');
    if (no && typeof no === 'object' && 'children' in no) {
      return juntar((no as { children: unknown }).children);
    }
    return '';
  };
  return juntar(r.toJSON()).replace(/\s+/g, ' ');
}

function botoes(r: ReactTestRenderer, rotulo: string) {
  return r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .filter((n) => n.props.label === rotulo);
}

/**
 * Toca no botão SEM olhar ao `disabled`.
 *
 * De propósito, como no teste do `conta/apagar`: o que se quer provar é que o
 * próprio manipulador se recusa a apagar. Um ecrã que só se defende com a
 * opacidade do botão está a uma refactorização de distância de apagar contas
 * por engano.
 */
function tocar(r: ReactTestRenderer, rotulo: string) {
  const nos = botoes(r, rotulo);
  if (nos.length === 0) throw new Error(`Não há botão com o rótulo "${rotulo}"`);
  act(() => (nos[nos.length - 1].props.onPress as () => void)());
}

function escrever(r: ReactTestRenderer, texto: string) {
  const campos = r.root.findAll((n) => typeof n.props?.onChangeText === 'function');
  if (campos.length === 0) throw new Error('Não há campo de texto no ecrã');
  act(() => (campos[campos.length - 1].props.onChangeText as (t: string) => void)(texto));
}

async function abrir(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <EcraPendente />
      </SafeAreaProvider>,
    );
  });
  return r;
}

/** Abre o ecrã e destranca o formulário de apagar. */
async function abrirComFormulario(): Promise<ReactTestRenderer> {
  const r = await abrir();
  tocar(r, 'Apagar a minha conta');
  return r;
}

describe('EcraPendente: apagar a conta', () => {
  beforeEach(() => {
    mockEstado.estadoPerfil = 'pendente';
    mockEstado.apagarConta.mockReset();
    mockEstado.apagarConta.mockResolvedValue(null);
    mockEstado.saiu = 0;
    mockEstado.confirmacoes = [];
    mockEstado.avisos = [];
  });

  /**
   * O teste que falha sem a correção. Antes de 2026-08-24 este ecrã tinha
   * "Verificar novamente" e "Terminar sessão", e mais nada.
   */
  it('quem está à espera de aprovação tem por onde apagar a conta', async () => {
    const r = await abrir();
    expect(botoes(r, 'Apagar a minha conta').length).toBeGreaterThan(0);
  });

  it('o formulário está fechado até alguém lhe tocar', async () => {
    const r = await abrir();
    expect(textos(r)).not.toContain('para confirmar');
    tocar(r, 'Apagar a minha conta');
    expect(textos(r)).toContain('para confirmar');
  });

  it('sem a palavra escrita, tocar no botão não apaga nada', async () => {
    const r = await abrirComFormulario();
    tocar(r, 'Apagar a minha conta');
    expect(mockEstado.confirmacoes).toHaveLength(0);
    expect(mockEstado.apagarConta).not.toHaveBeenCalled();
  });

  it('com a palavra errada, também não', async () => {
    const r = await abrirComFormulario();
    escrever(r, 'apagar tudo');
    tocar(r, 'Apagar a minha conta');
    expect(mockEstado.apagarConta).not.toHaveBeenCalled();
  });

  /** Minúsculas e espaços à volta contam: quem escreveu percebeu o que lhe foi pedido. */
  it('com a palavra escrita, pergunta uma última vez antes de apagar', async () => {
    const r = await abrirComFormulario();
    escrever(r, ' apagar ');
    tocar(r, 'Apagar a minha conta');

    expect(mockEstado.confirmacoes).toHaveLength(1);
    // Ainda não apagou: a pergunta está por responder.
    expect(mockEstado.apagarConta).not.toHaveBeenCalled();

    await act(async () => mockEstado.confirmacoes[0].aoConfirmar());
    expect(mockEstado.apagarConta).toHaveBeenCalledTimes(1);
  });

  /**
   * A conta não tem exploração nenhuma, portanto a pergunta não pode enumerar
   * explorações nem animais. É o texto do "sem dados" que o `conta/apagar`
   * usa no mesmo caso.
   */
  it('a pergunta não promete apagar dados que esta conta não tem', async () => {
    const r = await abrirComFormulario();
    escrever(r, 'APAGAR');
    tocar(r, 'Apagar a minha conta');
    expect(mockEstado.confirmacoes[0].mensagem).toContain('perder o acesso');
    expect(mockEstado.confirmacoes[0].mensagem).not.toContain('explorações');
  });

  it('apagada, avisa por fora do ecrã (que desaparece com a sessão)', async () => {
    const r = await abrirComFormulario();
    escrever(r, 'APAGAR');
    tocar(r, 'Apagar a minha conta');
    await act(async () => mockEstado.confirmacoes[0].aoConfirmar());
    expect(mockEstado.avisos).toHaveLength(1);
    expect(mockEstado.avisos[0].titulo).toBe('Conta apagada');
  });

  /**
   * Se o servidor recusar, a razão fica à vista e a palavra continua escrita.
   * Fechar o formulário aqui seria esconder a falha.
   */
  it('se o servidor recusar, diz porquê e não finge que apagou', async () => {
    mockEstado.apagarConta.mockResolvedValue('sem sessão iniciada');
    const r = await abrirComFormulario();
    escrever(r, 'APAGAR');
    tocar(r, 'Apagar a minha conta');
    await act(async () => mockEstado.confirmacoes[0].aoConfirmar());

    expect(textos(r)).toContain('sem sessão iniciada');
    expect(mockEstado.avisos).toHaveLength(0);
    expect(textos(r)).toContain('para confirmar');
  });

  it('"Afinal não" fecha o formulário e esquece o que estava escrito', async () => {
    const r = await abrirComFormulario();
    escrever(r, 'APAGAR');
    tocar(r, 'Afinal não');
    expect(textos(r)).not.toContain('para confirmar');

    tocar(r, 'Apagar a minha conta');
    tocar(r, 'Apagar a minha conta');
    expect(mockEstado.apagarConta).not.toHaveBeenCalled();
  });

  /**
   * O gate do `_layout.tsx` é `membros.length === 0`, não `estado='pendente'`.
   * Quem já foi aprovado mas ainda não criou exploração vê este mesmo ecrã, e
   * tinha o mesmo buraco.
   */
  it('uma conta já aprovada sem exploração também se pode apagar', async () => {
    mockEstado.estadoPerfil = 'ativo';
    const r = await abrirComFormulario();
    escrever(r, 'APAGAR');
    tocar(r, 'Apagar a minha conta');
    await act(async () => mockEstado.confirmacoes[0].aoConfirmar());
    expect(mockEstado.apagarConta).toHaveBeenCalledTimes(1);
  });
});
