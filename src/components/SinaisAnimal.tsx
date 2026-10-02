import { Pressable, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { SINAIS, type Sinal } from '@/data/sinaisAlerta';
import { t, type ChaveTexto } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * A cor de cada sinal, a do guia de estilo: terracota para o que é legal
 * (brinco, SNIRA), ocre para a reprodução, verde-azulado para a saúde. São os
 * tons VIVOS, porque aqui são só pontos, sem letra por cima.
 *
 * FUNÇÃO e não tabela de módulo: as cores são reescritas no arranque conforme
 * a paleta escolhida, e um `Record` criado no import ficava com as da paleta
 * de origem (ver a nota do `colors` no AGENTS.md).
 */
export function corDoSinal(s: Sinal): string {
  if (s === 'legal') return colors.dangerVivo;
  if (s === 'reproducao') return colors.warningVivo;
  return colors.saudeVivo;
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
 * Os mesmos pontos, em linha, ao lado do nome (a lista de animais do guia de
 * estilo põe-nos a seguir ao número do animal, e não em cima do retrato).
 */
export function PontosEmLinha({ sinais }: { sinais: Sinal[] }) {
  if (sinais.length === 0) return null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      {sinais.map((s) => (
        <View key={s} style={{ width: 11, height: 11, borderRadius: radii.pill, backgroundColor: corDoSinal(s) }} />
      ))}
    </View>
  );
}

/**
 * A legenda das cores, por cima da lista.
 *
 * Sem ela os pontos eram enfeite: uma bolinha ocre não diz "esta vaca está para
 * parir" a quem a vê pela primeira vez. Só aparece quando há pontos na lista
 * para explicar — numa exploração sem nada pendente seria uma linha a explicar
 * o que não está lá.
 *
 * São as pastilhas do guia de estilo: cada sinal com o seu ponto de cor, a
 * escolhida cheia da cor da marca, e o "Limpar" sublinhado ao lado. Quando não
 * cabem numa linha, partem para a seguinte como pastilhas que são (soltas,
 * cada uma com a sua moldura), e já não se leem como uma frase cortada.
 */
export function LegendaSinais({
  sinais,
  ativo = null,
  onEscolher,
}: {
  sinais: Sinal[];
  /** O sinal por que a lista está filtrada, se estiver. */
  ativo?: Sinal | null;
  /**
   * Tocar num sinal filtra a lista por ele (e tocar outra vez, ou em Limpar,
   * tira o filtro). Sem isto a legenda só explica as cores, como antes.
   */
  onEscolher?: (s: Sinal | null) => void;
}) {
  const visiveis = SINAIS.filter((x) => sinais.includes(x));
  if (visiveis.length === 0) return null;

  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.md,
      }}>
      {visiveis.map((x) => {
        const escolhido = ativo === x;
        if (!onEscolher) {
          return (
            <View
              key={x}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                height: 44,
                paddingHorizontal: spacing.md,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}>
              <View style={{ width: 10, height: 10, borderRadius: radii.pill, backgroundColor: corDoSinal(x) }} />
              <Text variant="label">{rotuloDoSinal(x)}</Text>
            </View>
          );
        }
        return (
          <Chip
            key={x}
            label={rotuloDoSinal(x)}
            ponto={corDoSinal(x)}
            selected={escolhido}
            onPress={() => onEscolher(escolhido ? null : x)}
            accessibilityLabel={`${t('sinal.mostrarSo')}: ${rotuloDoSinal(x)}`}
          />
        );
      })}
      {onEscolher && ativo ? (
        <Pressable
          onPress={() => onEscolher(null)}
          accessibilityRole="button"
          accessibilityLabel={t('sinal.limparFiltro')}
          hitSlop={8}
          style={({ pressed }) => [
            { height: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
            pressed && { opacity: 0.6 },
          ]}>
          <Text variant="label" color={colors.primaryDark} style={{ textDecorationLine: 'underline' }}>
            {t('sinal.limpar')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
