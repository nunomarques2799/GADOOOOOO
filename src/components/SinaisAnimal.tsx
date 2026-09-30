import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
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
  // Numa linha se as três couberem; se não, uma por linha. Duas numa linha e a
  // terceira sozinha por baixo (o que o `flexWrap` dava) lia-se como se a de
  // baixo fosse outra coisa. Mede-se o que cada uma ocupa e a largura que há.
  const [larguras, setLarguras] = useState<Partial<Record<Sinal, number>>>({});
  const [disponivel, setDisponivel] = useState(0);
  const visiveis = SINAIS.filter((x) => sinais.includes(x));
  const precisa =
    visiveis.reduce((soma, x) => soma + (larguras[x] ?? 0), 0) + spacing.xs * (visiveis.length - 1);
  const medido = disponivel > 0 && visiveis.every((x) => larguras[x] !== undefined);
  const numaLinha = !medido || precisa <= disponivel;

  if (visiveis.length === 0) return null;

  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        padding: spacing.xs,
        marginBottom: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceSunken,
      }}>
      <View
        onLayout={(e) => setDisponivel(e.nativeEvent.layout.width)}
        style={{
          flex: 1,
          flexDirection: numaLinha ? 'row' : 'column',
          alignItems: numaLinha ? 'center' : 'flex-start',
          gap: numaLinha ? spacing.xs : 2,
          // Enquanto não se mede, a linha não pode empurrar o botão Limpar.
          overflow: 'hidden',
        }}>
        {visiveis.map((x) => {
          const escolhido = ativo === x;
          const conteudo = (
            <>
              <View
                style={{ width: 11, height: 11, borderRadius: radii.pill, backgroundColor: corDoSinal(x) }}
              />
              <Text
                variant="caption"
                color={escolhido ? colors.text : colors.textSecondary}
                style={escolhido ? { fontWeight: '700' } : undefined}
                numberOfLines={1}>
                {rotuloDoSinal(x)}
              </Text>
            </>
          );
          const estilo = {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            gap: 5,
            flexShrink: 0,
            minHeight: 36,
            paddingHorizontal: spacing.sm,
            borderRadius: radii.pill,
            borderWidth: 1.5,
            borderColor: escolhido ? corDoSinal(x) : 'transparent',
            backgroundColor: escolhido ? colors.surface : 'transparent',
          };
          const medir = (w: number) =>
            setLarguras((l) => (Math.abs((l[x] ?? -1) - w) < 1 ? l : { ...l, [x]: w }));
          if (!onEscolher) {
            return (
              <View key={x} style={estilo} onLayout={(e) => medir(e.nativeEvent.layout.width)}>
                {conteudo}
              </View>
            );
          }
          return (
            <Pressable
              key={x}
              onPress={() => onEscolher(escolhido ? null : x)}
              onLayout={(e) => medir(e.nativeEvent.layout.width)}
              accessibilityRole="button"
              accessibilityState={{ selected: escolhido }}
              accessibilityLabel={`${t('sinal.mostrarSo')}: ${rotuloDoSinal(x)}`}
              style={({ pressed }) => [estilo, pressed && { opacity: 0.6 }]}>
              {conteudo}
            </Pressable>
          );
        })}
      </View>
      {onEscolher && ativo ? (
        <Pressable
          onPress={() => onEscolher(null)}
          accessibilityRole="button"
          accessibilityLabel={t('sinal.limparFiltro')}
          hitSlop={6}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              minHeight: 36,
              paddingHorizontal: spacing.sm,
              borderRadius: radii.pill,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            },
            pressed && { opacity: 0.6 },
          ]}>
          <Icon name="close" size="sm" color={colors.textSecondary} />
          <Text variant="caption" color={colors.textSecondary}>
            {t('sinal.limpar')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
