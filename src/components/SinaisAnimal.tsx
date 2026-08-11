import { View } from 'react-native';

import { Text } from '@/components/ui';
import { SINAIS, type Sinal } from '@/data/sinaisAlerta';
import { t, type ChaveTexto } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * A cor de cada sinal. FUNÇÃO e não tabela de módulo: as cores são reescritas no
 * arranque conforme a paleta escolhida, e um `Record` criado no import ficava
 * com as da paleta de origem (ver a nota do `colors` no AGENTS.md).
 */
export function corDoSinal(s: Sinal): string {
  if (s === 'legal') return colors.danger;
  if (s === 'reproducao') return colors.info;
  return colors.warning;
}

const CHAVE_DO_SINAL: Record<Sinal, ChaveTexto> = {
  legal: 'sinal.legal',
  reproducao: 'sinal.reproducao',
  saude: 'sinal.saude',
};

/** O que cada cor quer dizer, por palavras. Lido no render (idioma e paleta). */
export function rotuloDoSinal(s: Sinal): string {
  return t(CHAVE_DO_SINAL[s]);
}

/**
 * Os pontos, encostados ao fundo do retrato do animal.
 *
 * Em baixo e ao centro, e não no canto: no canto tapavam a cara do animal, que
 * é precisamente o que se procura na lista. O aro branco separa-os da fotografia
 * para se verem sobre um pelo escuro tanto como sobre um claro.
 */
export function PontosSinal({ sinais }: { sinais: Sinal[] }) {
  if (sinais.length === 0) return null;

  return (
    <View
      // Não é foco de leitor de ecrã: o que estes pontos dizem já vai na
      // etiqueta falada da linha inteira (ver `AnimalRow`). Anunciá-los outra
      // vez obrigava a ouvir a mesma coisa duas vezes por animal.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        bottom: -3,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 3,
      }}>
      {sinais.map((s) => (
        <View
          key={s}
          style={{
            width: 13,
            height: 13,
            borderRadius: radii.pill,
            backgroundColor: corDoSinal(s),
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      ))}
    </View>
  );
}

/**
 * A legenda das cores, por cima da lista.
 *
 * Sem ela os pontos eram enfeite: uma bolinha azul não diz "esta vaca está para
 * parir" a quem a vê pela primeira vez. Só aparece quando há pontos na lista
 * para explicar — numa exploração sem nada pendente seria uma linha a explicar
 * o que não está lá.
 */
export function LegendaSinais({ sinais }: { sinais: Sinal[] }) {
  if (sinais.length === 0) return null;

  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceSunken,
      }}>
      {SINAIS.filter((s) => sinais.includes(s)).map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            style={{
              width: 11,
              height: 11,
              borderRadius: radii.pill,
              backgroundColor: corDoSinal(s),
            }}
          />
          <Text variant="caption" color={colors.textSecondary}>
            {rotuloDoSinal(s)}
          </Text>
        </View>
      ))}
    </View>
  );
}
