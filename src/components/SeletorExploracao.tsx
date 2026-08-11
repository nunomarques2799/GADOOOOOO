import { useState } from 'react';
import { Modal, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components/ui';
import { t } from '@/i18n';
import { colors, radii, shadow, spacing, type } from '@/theme';

/** O mínimo que este seletor precisa de saber de uma exploração. */
export type OpcaoExploracao = { id: string; nome: string };

/**
 * De que exploração são os dados que estou a ver.
 *
 * UM botão só, e não a fila de chips que aqui esteve. A fila punha "Todas" à
 * esquerda e a seguir uma pastilha por cada quinta: com duas quintas de nomes
 * como "Herdade do Vale Escuro" a fila saía pela direita do ecrã, e num
 * telemóvel de 375px com a letra do sistema grande o que se via era "Todas" e
 * meia palavra cortada na margem. Quem tinha três quintas nem sabia que a
 * terceira existia.
 *
 * Assim o botão diz sempre em que contexto se está (Todas, ou o nome da quinta
 * escolhida) e as hipóteses aparecem numa folha, com uma linha por exploração e
 * o nome inteiro, por muito comprido que seja.
 */
export function SeletorExploracao({
  exploracoes,
  valor,
  onEscolher,
  style,
}: {
  exploracoes: OpcaoExploracao[];
  /** Id da exploração escolhida; `undefined` é "Todas". */
  valor: string | undefined;
  onEscolher: (id: string | undefined) => void;
  style?: ViewStyle;
}) {
  const [aberto, setAberto] = useState(false);
  const insets = useSafeAreaInsets();

  const escolhida = exploracoes.find((e) => e.id === valor);
  const rotulo = escolhida?.nome ?? t('comum.todas');

  function escolher(id: string | undefined) {
    onEscolher(id);
    setAberto(false);
  }

  return (
    <View style={[{ flexDirection: 'row' }, style]}>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={t('exploracao.filtroRotulo', { nome: rotulo })}
        accessibilityHint={t('exploracao.filtroAjuda')}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            // Encolhe em vez de empurrar: um nome comprido corta-se com
            // reticências dentro da pastilha e nunca leva a linha para fora.
            flexShrink: 1,
            minHeight: 44,
            paddingLeft: spacing.md,
            paddingRight: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          pressed && { opacity: 0.85 },
        ]}>
        <Icon name="barn" size="sm" color={colors.onPrimary} />
        <Text numberOfLines={1} style={[type.label, { color: colors.onPrimary, flexShrink: 1 }]}>
          {rotulo}
        </Text>
        <Icon name="chevron-down" size="sm" color={colors.onPrimary} />
      </Pressable>

      <Modal
        visible={aberto}
        animationType="slide"
        transparent
        onRequestClose={() => setAberto(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setAberto(false)}
            accessibilityLabel={t('comum.fechar')}
          />
          <View
            style={[
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                paddingTop: spacing.md,
                paddingBottom: insets.bottom + spacing.md,
                maxHeight: '80%',
              },
              shadow.lg,
            ]}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                marginBottom: spacing.sm,
              }}>
              <Text variant="h3" style={{ flex: 1 }}>
                {t('exploracao.escolher')}
              </Text>
              <Pressable
                onPress={() => setAberto(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('comum.fechar')}>
                <Icon name="close" size="lg" color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
              <Linha
                rotulo={t('comum.todas')}
                icone="barn"
                escolhido={valor === undefined}
                onPress={() => escolher(undefined)}
              />
              {exploracoes.map((e) => (
                <Linha
                  key={e.id}
                  rotulo={e.nome}
                  icone="barn"
                  escolhido={valor === e.id}
                  onPress={() => escolher(e.id)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Linha({
  rotulo,
  icone,
  escolhido,
  onPress,
}: {
  rotulo: string;
  icone: 'barn';
  escolhido: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: escolhido }}
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          // Alvo generoso: é uma folha percorrida com o polegar, muitas vezes
          // de pé no campo.
          minHeight: 56,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icone} size="md" color={escolhido ? colors.primary : colors.textMuted} />
      <Text
        variant={escolhido ? 'bodyStrong' : 'body'}
        color={escolhido ? colors.primaryDark : colors.text}
        style={{ flex: 1 }}>
        {rotulo}
      </Text>
      {escolhido ? <Icon name="check" size="md" color={colors.primary} /> : null}
    </Pressable>
  );
}
