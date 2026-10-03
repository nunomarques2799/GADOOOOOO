import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useColunas } from '@/hooks/useDesktop';
import { spacing } from '@/theme';

/**
 * Duas colunas no computador (a partir de 1100px, ver `useColunas`); uma
 * pilha, pela mesma ordem, no telemóvel e nas janelas estreitas.
 *
 * As fichas e vários separadores eram uma coluna única de 1180px: uma linha
 * "Data de nascimento ........ 25 ago 2021" com a etiqueta encostada à esquerda
 * e o valor a um palmo de distância, e o histórico só a aparecer depois de
 * rolar três ecrãs. É o desenho do telemóvel, esticado. Aqui o conteúdo
 * reparte-se em duas colunas, cada uma com a largura de um cartão que se lê
 * de relance.
 *
 * A ordem em que se reparte tem de ser a ordem do telemóvel: o que fica na
 * coluna da esquerda é o que vinha primeiro.
 *
 * A ÁRVORE É A MESMA NOS DOIS DESENHOS, e só os estilos mudam. Até 2026-10-03
 * o desenho estreito devolvia os dois blocos soltos e o largo embrulhava-os em
 * colunas: para o React são árvores diferentes, e cruzar os 1100px a
 * redimensionar a janela deitava fora tudo o que estava lá dentro (o
 * formulário de saída a meio de preencher, por exemplo).
 */
export function Colunas({
  esquerda,
  direita,
  proporcao = [1, 1],
  espaco = 0,
}: {
  esquerda: ReactNode;
  direita: ReactNode;
  /** Quanto cresce cada coluna (`flex`). Por omissão, metade e metade. */
  proporcao?: [number, number];
  /**
   * O espaço entre os dois blocos quando ficam em pilha. Os ecrãs cujos blocos
   * já trazem margem própria deixam a 0; os que os punham lado a lado num pai
   * com `gap` passam aqui esse `gap`.
   */
  espaco?: number;
}) {
  const colunas = useColunas();
  return (
    <View
      style={
        colunas
          ? { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }
          : { gap: espaco }
      }>
      <View style={colunas ? { flex: proporcao[0], minWidth: 0 } : undefined}>{esquerda}</View>
      <View style={colunas ? { flex: proporcao[1], minWidth: 0 } : undefined}>{direita}</View>
    </View>
  );
}
