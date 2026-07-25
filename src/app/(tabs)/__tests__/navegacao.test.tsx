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

jest.mock('expo-router', () => {
  const { View: Caixa } = jest.requireActual<typeof import('react-native')>('react-native');
  // `Tabs` e `Tabs.Screen` viram caixas vazias: aqui só interessa a navegação.
  const Tabs = ({ children }: { children?: unknown }) => <Caixa>{children as never}</Caixa>;
  Tabs.Screen = () => null;
  return { Tabs, useRouter: () => ({ navigate: () => {} }) };
});

jest.mock('@/hooks/useDesktop', () => ({ useDesktop: () => true, BREAKPOINT_DESKTOP: 900 }));

jest.mock('@/data/membros', () => {
  const api = { podeEmAlguma: () => mockComEquipa.valor };
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
});
