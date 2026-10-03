import { Image } from 'expo-image';
import { View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { useColunas } from '@/hooks/useDesktop';
import { colors, radii, spacing } from '@/theme';

export type NumeroTitulo = { valor: string | number; rotulo: string };

/**
 * O cartão do topo de uma ficha de exploração ou de terreno: a fotografia (ou o
 * desenho), o nome em Fraunces, uma linha de onde fica, e três números.
 *
 * Era um bloco verde-escuro em degradê com letra branca, do desenho de antes
 * da marca nova, e foi o que ficou para trás quando o resto da app passou ao
 * guia de estilo: no meio do creme lia-se como um ecrã de outra app. Aqui é o
 * papel do guia (cartão claro, risca fina, retrato em areia) e os números em
 * Fraunces, como no Resumo do Início.
 *
 * No computador os números vão para a direita do nome, na mesma linha: há
 * largura de sobra, e empilhados ficavam três colunas de 400px com uma palavra
 * em cada.
 */
export function CartaoTitulo({
  fotografia,
  icone,
  titulo,
  iconeLinha,
  linha,
  numeros,
}: {
  fotografia?: string | null;
  icone: IconName;
  titulo: string;
  iconeLinha: IconName;
  linha: string;
  numeros: NumeroTitulo[];
}) {
  // Os números ao lado do nome só com largura para isso (ver `useColunas`).
  const desktop = useColunas();

  const retrato = (
    <View
      style={{
        width: desktop ? 84 : 64,
        height: desktop ? 84 : 64,
        borderRadius: radii.lg,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      {fotografia ? (
        <Image source={{ uri: fotografia }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Icon name={icone} size={desktop ? 44 : 36} color={colors.primaryDark} />
      )}
    </View>
  );

  const nome = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text variant="h1" numberOfLines={2}>
        {titulo}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <Icon name={iconeLinha} size={16} color={colors.textSecondary} />
        <Text variant="secondary" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
          {linha}
        </Text>
      </View>
    </View>
  );

  const lista = numeros.map((n, i) => (
    <View
      key={n.rotulo}
      style={
        desktop
          ? {
              minWidth: 110,
              paddingLeft: spacing.lg,
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: colors.border,
            }
          : // Pelo tamanho do que lá está escrito, e não em terços iguais:
            // "Pastagem" em Fraunces não cabe num terço de telemóvel e
            // escrevia-se colado ao "4.2 ha" do lado (já acontecia no bloco
            // verde de antes).
            { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 }
      }>
      <Text variant="h2" numberOfLines={1}>
        {n.valor}
      </Text>
      <Text variant="rotulo" color={colors.textSecondary} numberOfLines={1}>
        {n.rotulo}
      </Text>
    </View>
  ));

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: desktop ? spacing.xl : spacing.lg,
      }}>
      {desktop ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          {retrato}
          {nome}
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>{lista}</View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {retrato}
            {nome}
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              marginTop: spacing.md,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            {lista}
          </View>
        </>
      )}
    </View>
  );
}
