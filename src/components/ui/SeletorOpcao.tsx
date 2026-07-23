import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadow, sizes, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Escolha de um valor a partir de uma lista, com procura e com a hipótese de
 * acrescentar um que não esteja lá.
 *
 * Existe para a raça e a pelagem deixarem de ser texto livre. Uma lista de
 * chips como as da espécie não servia: são vinte e tal raças por espécie, e
 * vinte chips embrulhados empurram o resto do formulário para fora do ecrã.
 * Daí o campo fechado que abre em folha, com um alvo por linha — o mesmo
 * padrão que já se usa nas definições, e o que melhor se acerta com o dedo.
 *
 * Acrescentar não guarda nada em lado nenhum: o valor novo vai para a coluna
 * de texto do animal, e a lista volta a encontrá-lo porque quem chama junta
 * às sugestões o que já existe no efetivo (ver `opcoesComUsadas`).
 */
export function SeletorOpcao({
  valor,
  opcoes,
  onEscolher,
  titulo,
  placeholder = 'Escolher',
  icon,
  /** Texto do botão que aceita o que foi escrito na procura. */
  rotuloAdicionar = 'Usar',
  /** Compara duas grafias para não oferecer "adicionar" ao que já existe. */
  normalizar = (s: string) => s.trim().toLowerCase(),
}: {
  valor?: string;
  opcoes: string[];
  onEscolher: (v: string | undefined) => void;
  titulo: string;
  placeholder?: string;
  icon?: IconName;
  rotuloAdicionar?: string;
  normalizar?: (s: string) => string;
}) {
  const [aberto, setAberto] = useState(false);
  const [procura, setProcura] = useState('');
  const insets = useSafeAreaInsets();

  const filtradas = useMemo(() => {
    const q = normalizar(procura);
    if (!q) return opcoes;
    return opcoes.filter((o) => normalizar(o).includes(q));
  }, [opcoes, procura, normalizar]);

  // Só se oferece "adicionar" quando o que está escrito não existe já — senão
  // criava-se um duplicado da mesma raça com outra grafia, que é precisamente
  // o que a lista veio evitar.
  const escrito = procura.trim();
  const podeAdicionar =
    escrito.length > 0 && !opcoes.some((o) => normalizar(o) === normalizar(escrito));

  function fechar() {
    setAberto(false);
    setProcura('');
  }

  function escolher(v: string | undefined) {
    onEscolher(v);
    fechar();
  }

  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={valor ? `${titulo}: ${valor}` : `Escolher ${titulo.toLowerCase()}`}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            minHeight: sizes.input,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          },
          pressed && { opacity: 0.8 },
        ]}>
        {icon ? <Icon name={icon} size="md" color={colors.textMuted} /> : null}
        <Text
          variant="body"
          color={valor ? colors.text : colors.textMuted}
          style={{ flex: 1, fontFamily: 'Nunito_600SemiBold' }}>
          {valor ?? placeholder}
        </Text>
        {valor ? (
          <Pressable
            onPress={() => onEscolher(undefined)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Limpar ${titulo.toLowerCase()}`}>
            <Icon name="close-circle" size="md" color={colors.textMuted} />
          </Pressable>
        ) : (
          <Icon name="chevron-down" size="md" color={colors.textMuted} />
        )}
      </Pressable>

      <Modal
        visible={aberto}
        animationType="slide"
        transparent
        onRequestClose={fechar}
        // Sem isto, no Android o botão físico de voltar fecha a app inteira
        // em vez da folha.
        accessibilityViewIsModal>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={fechar} accessibilityLabel="Fechar" />
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
                {titulo}
              </Text>
              <Pressable
                onPress={fechar}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Fechar">
                <Icon name="close" size="lg" color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  height: sizes.input,
                  borderRadius: radii.md,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                }}>
                <Icon name="magnify" size="md" color={colors.textMuted} />
                <TextInput
                  value={procura}
                  onChangeText={setProcura}
                  placeholder="Procurar ou escrever uma nova"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  style={{
                    flex: 1,
                    fontFamily: 'Nunito_600SemiBold',
                    fontSize: 17,
                    color: colors.text,
                  }}
                />
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
              {podeAdicionar ? (
                <Linha
                  rotulo={`${rotuloAdicionar} “${escrito}”`}
                  icone="plus-circle-outline"
                  cor={colors.primary}
                  onPress={() => escolher(escrito)}
                />
              ) : null}
              {filtradas.map((o) => (
                <Linha
                  key={o}
                  rotulo={o}
                  icone={valor === o ? 'check-circle' : 'circle-outline'}
                  cor={valor === o ? colors.primary : colors.textMuted}
                  destacado={valor === o}
                  onPress={() => escolher(o)}
                />
              ))}
              {filtradas.length === 0 && !podeAdicionar ? (
                <Text
                  variant="secondary"
                  color={colors.textMuted}
                  style={{ paddingVertical: spacing.lg, textAlign: 'center' }}>
                  Nada encontrado.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Linha({
  rotulo,
  icone,
  cor,
  destacado,
  onPress,
}: {
  rotulo: string;
  icone: IconName;
  cor: string;
  destacado?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          // Alvo generoso de propósito: é uma lista longa, percorrida com o
          // polegar e muitas vezes de pé no campo.
          minHeight: 56,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icone} size="md" color={cor} />
      <Text
        variant={destacado ? 'bodyStrong' : 'body'}
        color={destacado ? colors.primaryDark : colors.text}
        style={{ flex: 1 }}>
        {rotulo}
      </Text>
    </Pressable>
  );
}
