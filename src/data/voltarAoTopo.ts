/**
 * Tocar outra vez no separador em que já se está volta ao topo da página.
 * ------------------------------------------------------------------
 * É o gesto que toda a gente já traz aprendido de outras apps, e nesta faz
 * falta a sério: o Início e os Alertas são listas compridas, e quem rolou até
 * ao fim para ver o último animal ficava a arrastar o dedo para trás durante
 * segundos. Tocar no ícone que está aceso não fazia nada.
 *
 * Uma LOJA DE MÓDULO e não um contexto, pela mesma razão do contador das
 * denúncias: quem toca (a barra de baixo, em `(tabs)/_layout.tsx`) e quem rola
 * (o ecrã) são componentes irmãos, e um `useState` num deles não chega ao
 * outro. Aqui cada ecrã deixa a sua lista escrita numa tabela, e a barra
 * procura-a pelo nome do separador.
 *
 * O react-navigation traz um `useScrollToTop` que faz isto sozinho, e não se
 * usa: esta app tem uma barra de baixo própria (`TabBar`), que trata do
 * `tabPress` à mão para caber o botão de registar ao meio. O hook dele nunca
 * chegaria a ser chamado.
 */

import { useCallback } from 'react';

/**
 * O mínimo que se pede a uma lista para se poder voltar ao topo dela.
 *
 * São três métodos e não um porque os três contentores que esta app usa não
 * concordam em nenhum: o `ScrollView` tem `scrollTo`, a `FlatList` tem
 * `scrollToOffset`, e a `SectionList` não tem nem um nem outro — chega-se ao
 * dela pelo `getScrollResponder()`. Chamar o método errado não dá erro: não faz
 * nada, que é a maneira mais fácil de isto ficar partido sem se notar.
 */
export type ListaComTopo = {
  scrollTo?: (opcoes: { y: number; animated: boolean }) => void;
  scrollToOffset?: (opcoes: { offset: number; animated: boolean }) => void;
  /**
   * `unknown` e não o tipo certo: o React Native declara isto como
   * `Element | null | undefined`, que não encaixa em nada de útil. Um tipo mais
   * apertado aqui fazia o `ref` de cada lista deixar de compilar; a verificação
   * fica em baixo, no momento de o chamar, que é onde vale.
   */
  getScrollResponder?: () => unknown;
};

const listas = new Map<string, ListaComTopo>();

/**
 * O ecrã diz "a minha lista é esta". `null` apaga o registo — e apagar é
 * preciso: sem isso, um ecrã desmontado deixava aqui uma referência morta, e o
 * toque seguinte no separador ia bater numa lista que já não está no ecrã.
 */
export function registarLista(separador: string, lista: ListaComTopo | null): void {
  if (lista) listas.set(separador, lista);
  else listas.delete(separador);
}

/**
 * Manda a lista deste separador para o topo, com animação.
 *
 * Devolve `false` quando não há lista registada (um ecrã que não rola, ou que
 * ainda não montou), para quem chama poder decidir o que fazer em vez disso.
 *
 * O `ScrollView` e a `FlatList` não partilham o mesmo método, e por isso
 * tentam-se os dois: a `FlatList` tem `scrollToOffset` e o `scrollTo` dela não
 * faz nada (nem dá erro, que é o que torna isto fácil de errar em silêncio).
 */
export function voltarAoTopo(separador: string): boolean {
  const lista = listas.get(separador);
  if (!lista) return false;
  if (typeof lista.scrollToOffset === 'function') {
    lista.scrollToOffset({ offset: 0, animated: true });
    return true;
  }
  if (typeof lista.scrollTo === 'function') {
    lista.scrollTo({ y: 0, animated: true });
    return true;
  }
  if (typeof lista.getScrollResponder === 'function') {
    const dentro = lista.getScrollResponder() as ListaComTopo | null | undefined;
    if (dentro && typeof dentro.scrollTo === 'function') {
      dentro.scrollTo({ y: 0, animated: true });
      return true;
    }
  }
  return false;
}

/**
 * A função de `ref` que um ecrã põe na sua lista.
 *
 * O React chama-a com a lista quando ela monta e com `null` quando desmonta,
 * portanto a limpeza vem de graça — que é o ponto de ser um `ref` e não um
 * `useEffect` com o registo lá dentro.
 */
export function useVoltarAoTopo(separador: string): (lista: ListaComTopo | null) => void {
  return useCallback(
    (lista: ListaComTopo | null) => registarLista(separador, lista),
    [separador],
  );
}

/** Só para os testes: esquece tudo o que está registado. */
export function esquecerListas(): void {
  listas.clear();
}
