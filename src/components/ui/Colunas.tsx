import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useColunas } from '@/hooks/useDesktop';
import { spacing } from '@/theme';

/**
 * Duas colunas no computador; uma pilha, pela mesma ordem, no telemóvel.
 *
 * As fichas e vários separadores eram uma coluna única de 1180px: uma linha
 * "Data de nascimento ........ 25 ago 2021" com a etiqueta encostada à esquerda
 * e o valor a um palmo de distância, e o histórico só a aparecer depois de
 * rolar três ecrãs. É o desenho do telemóvel, esticado. Aqui o conteúdo
 * reparte-se em duas colunas, cada uma com a largura de um cartão que se lê
 * de relance.
 *
 * No telemóvel não muda NADA: `esquerda` e depois `direita`, sem invólucro
 * nenhum. Por isso a ordem em que se reparte tem de ser a ordem do telemóvel
 * (o que fica na coluna da esquerda é o que vinha primeiro).
 */
export function Colunas({
  esquerda,
  direita,
  proporcao = [1, 1],
}: {
  esquerda: ReactNode;
  direita: ReactNode;
  /** Quanto cresce cada coluna (`flex`). Por omissão, metade e metade. */
  proporcao?: [number, number];
}) {
  const colunas = useColunas();
  if (!colunas) {
    return (
      <>
        {esquerda}
        {direita}
      </>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
      <View style={{ flex: proporcao[0], minWidth: 0 }}>{esquerda}</View>
      <View style={{ flex: proporcao[1], minWidth: 0 }}>{direita}</View>
    </View>
  );
}
