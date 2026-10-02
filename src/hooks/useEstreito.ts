import { useWindowDimensions } from 'react-native';

/**
 * Abaixo disto (em pontos de letra, ver em baixo), os desenhos lado a lado do
 * guia de estilo deixam de caber e empilham-se.
 */
export const LARGURA_ESTREITA = 340;

/**
 * O ecrã é estreito PARA A LETRA que tem?
 *
 * Não chega olhar para a largura: um iPhone de 375 pontos com o "Tamanho da
 * letra" no máximo tem tanto espaço para palavras como um ecrã de 258 com a
 * letra normal (é o teste do AGENTS.md). Por isso a largura divide-se pela
 * escala da letra. Com isto, as linhas do guia de estilo que põem três coisas
 * lado a lado (o retrato, o nome e a etiqueta do sexo; o ícone, o aviso e o
 * prazo) passam a duas linhas antes de começarem a partir palavras a meio.
 */
export function useEstreito(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return width / Math.max(1, fontScale) < LARGURA_ESTREITA;
}
