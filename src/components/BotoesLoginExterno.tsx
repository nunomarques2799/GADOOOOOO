import { Pressable, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { configDoAmbiente, metodosConfigurados, type MetodoLogin } from '@/data/loginExterno';
import { t } from '@/i18n';
import { colors, radii, sizes, spacing } from '@/theme';

/**
 * As outras portas de entrada, por baixo do email.
 * ------------------------------------------------------------------
 * Só aparece o que está mesmo configurado (ver `metodosConfigurados`): um botão
 * que abre e devolve "provider is not enabled" é pior do que um botão que não
 * existe, sobretudo neste ecrã, onde quem o lê ainda não tem conta nenhuma para
 * onde voltar.
 *
 * Sem nenhum método configurado, o componente inteiro desaparece — incluindo a
 * linha do "ou". É o estado da app hoje, antes de as credenciais existirem, e
 * tem de ser indistinguível de nunca ter havido nada disto.
 */
export function BotoesLoginExterno({
  aProcessar,
  onEscolher,
}: {
  aProcessar: boolean;
  onEscolher: (metodo: MetodoLogin) => void;
}) {
  const metodos = metodosConfigurados(configDoAmbiente());
  if (metodos.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.lg }}>
      {/* A linha com o "ou" ao meio. Diz que o que vem a seguir é uma
          ALTERNATIVA ao que está em cima, e não mais um campo a preencher. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text variant="secondary" color={colors.textMuted}>
          {t('login.ouEntreCom')}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <View style={{ gap: spacing.sm }}>
        {metodos.map((m) => (
          <BotaoMetodo
            key={m}
            metodo={m}
            desativado={aProcessar}
            onPress={() => onEscolher(m)}
          />
        ))}
      </View>
    </View>
  );
}

const ICONE: Record<MetodoLogin, IconName> = {
  google: 'google',
  apple: 'apple',
  telemovel: 'cellphone',
};

/** O rótulo lê-se dentro do render, como manda a regra do `t()`. */
function rotulo(m: MetodoLogin): string {
  if (m === 'google') return t('login.comGoogle');
  if (m === 'apple') return t('login.comApple');
  return t('login.comTelemovel');
}

function BotaoMetodo({
  metodo,
  desativado,
  onPress,
}: {
  metodo: MetodoLogin;
  desativado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityLabel={rotulo(metodo)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          // A mesma altura dos campos de cima: postos em fila, botões mais
          // baixos do que os campos leem-se como menos importantes, e não são.
          height: sizes.input,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: desativado ? 0.6 : 1,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon name={ICONE[metodo]} size="md" color={colors.text} />
      <Text variant="bodyStrong">{rotulo(metodo)}</Text>
    </Pressable>
  );
}
