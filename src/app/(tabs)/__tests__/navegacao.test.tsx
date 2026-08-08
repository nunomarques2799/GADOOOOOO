/**
 * Que destinos é que cada pessoa vê na navegação.
 *
 * A aba Trabalhadores só faz sentido a quem tem equipa para gerir: um
 * trabalhador convidado não vê a lista de colegas (a RLS também não lha dava),
 * e um destino que abre sempre vazio é um destino a mais na barra. A rota
 * continua declarada — quem chegar lá por um link encontra o ecrã, que se
 * explica a si mesmo.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text as TextoRN, View } from 'react-native';

const mockComEquipa = { valor: true };
/** O que `podeVer(undefined, capacidade)` responde — por capacidade de leitura. */
const mockLeitura: Record<string, boolean> = { verFinancas: true, verDocumentos: true };

jest.mock('expo-router', () => {
  const { View: Caixa } = jest.requireActual<typeof import('react-native')>('react-native');
  // `Tabs` e `Tabs.Screen` viram caixas vazias: aqui só interessa a navegação.
  const Tabs = ({ children }: { children?: unknown }) => <Caixa>{children as never}</Caixa>;
  Tabs.Screen = () => null;
  return { Tabs, useRouter: () => ({ navigate: () => {} }) };
});

jest.mock('@/hooks/useDesktop', () => ({ useDesktop: () => true, BREAKPOINT_DESKTOP: 900 }));

/**
 * A folha do botão "+" não faz parte desta pergunta — aqui olha-se para os
 * DESTINOS que cada papel vê. Importá-la a sério puxava `useFinancas` → `store`
 * → `auth` → `supabase`, e com ele o AsyncStorage, que num teste de nós de
 * texto não existe: a suite rebentava antes de chegar ao primeiro `expect`.
 */
jest.mock('@/components/AcoesRapidas', () => ({ FolhaAcoesRapidas: () => null }));

/** O interruptor das Existências — ligado, para o separador entrar na conta. */
const mockExistencias = { ativas: true };
jest.mock('@/data/useExistencias', () => ({
  useExistencias: () => ({
    ativas: mockExistencias.ativas,
    podeLigarDesligar: true,
    podeGerir: true,
  }),
}));

jest.mock('@/data/membros', () => {
  const api = {
    podeEmAlguma: () => mockComEquipa.valor,
    podeVer: (_exploracaoId: string | undefined, cap: string) => mockLeitura[cap] ?? true,
  };
  return { useMembros: () => api };
});

// A barra lateral só precisa de mostrar os rótulos que recebeu.
jest.mock('@/components/BarraLateral', () => {
  const {
    View: Caixa,
    Text: Texto,
  } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BarraLateral: ({ itens }: { itens: { label: string }[] }) => (
      <Caixa>
        {itens.map((i) => (
          <Texto key={i.label}>{i.label}</Texto>
        ))}
      </Caixa>
    ),
  };
});

import TabsLayout from '../_layout';

function rotulos(r: ReactTestRenderer): string[] {
  return r.root.findAllByType(TextoRN).map((n) => String(n.props.children));
}

function montar() {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <View>
        <TabsLayout />
      </View>,
    );
  });
  return r;
}

describe('navegação por papel', () => {
  it('quem gere equipa vê a aba Trabalhadores', () => {
    mockComEquipa.valor = true;
    expect(rotulos(montar())).toContain('Trabalhadores');
  });

  it('quem não gere equipa não a vê', () => {
    mockComEquipa.valor = false;
    const lista = rotulos(montar());
    expect(lista).not.toContain('Trabalhadores');
    // Os outros destinos ficam todos — não se escondeu a app por engano.
    expect(lista).toContain('Animais');
    expect(lista).toContain('Perfil');
  });

  /**
   * O veterinário é uma visita: vem ver os animais e registar o que fez. As
   * contas da exploração e os ficheiros com o efetivo inteiro lá dentro não são
   * assunto dele — e um separador que abre só para dizer "não pode" é um
   * separador a mais na barra de quem já lá tem pouco espaço.
   */
  it('quem não vê contas nem documentos fica sem as duas abas', () => {
    mockComEquipa.valor = false;
    mockLeitura.verFinancas = false;
    mockLeitura.verDocumentos = false;
    const lista = rotulos(montar());
    expect(lista).not.toContain('Finanças');
    expect(lista).not.toContain('Documentos');
    // E o resto da app continua lá: é para trabalhar que ele foi convidado.
    expect(lista).toContain('Animais');
    expect(lista).toContain('Alertas');
    expect(lista).toContain('Explorações');
  });

  it('as duas abas são independentes uma da outra', () => {
    // O trabalhador não vê as contas e vê os documentos. Uma condição só para
    // as duas dava-lhe a app de um veterinário.
    mockComEquipa.valor = false;
    mockLeitura.verFinancas = false;
    mockLeitura.verDocumentos = true;
    const lista = rotulos(montar());
    expect(lista).not.toContain('Finanças');
    expect(lista).toContain('Documentos');
  });

  it('o dono vê tudo', () => {
    mockComEquipa.valor = true;
    mockLeitura.verFinancas = true;
    mockLeitura.verDocumentos = true;
    const lista = rotulos(montar());
    expect(lista).toContain('Finanças');
    expect(lista).toContain('Documentos');
    expect(lista).toContain('Trabalhadores');
  });

  /**
   * O registo de medicamentos é opt-in, como as finanças: quem leva o frasco do
   * veterinário não tem arrecadação nenhuma para gerir, e um separador
   * permanentemente vazio é uma pergunta por responder no meio da barra.
   *
   * A diferença para as finanças é que aqui NÃO há papel nenhum a decidir — o
   * trabalhador que vacina precisa de escolher o frasco tanto como o dono. A
   * única condição é o interruptor.
   */
  it('com o registo de medicamentos desligado, a aba Existências desaparece', () => {
    mockExistencias.ativas = false;
    const lista = rotulos(montar());
    expect(lista).not.toContain('Existências');
    // E o resto da app fica: desligou-se uma funcionalidade, não a navegação.
    expect(lista).toContain('Animais');
    expect(lista).toContain('Alertas');
  });

  it('e volta assim que se liga', () => {
    mockExistencias.ativas = true;
    expect(rotulos(montar())).toContain('Existências');
  });
});
