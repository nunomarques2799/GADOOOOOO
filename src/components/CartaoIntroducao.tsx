import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Icon, type IconName, Text } from '@/components/ui';
import {
  introducaoVista,
  marcarIntroducaoVista,
  type ChaveIntroducao,
} from '@/data/introducoes';
import { colors, radii, spacing } from '@/theme';

type Props = {
  chave: ChaveIntroducao;
  icon: IconName;
  titulo: string;
  /** Uma ideia por linha — lê-se de relance, ao contrário de um parágrafo. */
  pontos: string[];
};

/**
 * "Para que serve este separador", à primeira vez que se abre.
 * ------------------------------------------------------------------
 * Fica em cima do conteúdo do ecrã, explica-o em três ou quatro linhas e
 * desaparece com o "Percebi" — para sempre, nesse aparelho (ver
 * `data/introducoes.ts`). Volta com o "Rever os primeiros passos" da Ajuda.
 *
 * Não é um modal de propósito: um ecrã que se abre a tapar tudo obriga a
 * despachá-lo antes de sequer ver o que está por trás, e quem o despacha à
 * pressa fica sem a explicação. Assim lê-se com o ecrã à vista.
 */
export function CartaoIntroducao({ chave, icon, titulo, pontos }: Props) {
  // Lido uma vez, à montagem; fechar é decisão do momento e não espera por
  // recarregar a app.
  const [visivel, setVisivel] = useState(() => !introducaoVista(chave));
  if (!visivel) return null;

  function fechar() {
    marcarIntroducaoVista(chave);
    setVisivel(false);
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={icon} size="lg" color={colors.primary} />
        </View>
        <Text variant="h3" style={{ flex: 1 }}>
          {titulo}
        </Text>
      </View>

      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        {pontos.map((p, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Icon name="circle-small" size="md" color={colors.primary} />
            <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
              {p}
            </Text>
          </View>
        ))}
      </View>

      <Button
        label="Percebi"
        icon="check"
        variant="secondary"
        onPress={fechar}
        style={{ marginTop: spacing.md }}
      />
    </Card>
  );
}
