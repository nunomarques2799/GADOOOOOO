import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { colors, radii, sizes, spacing } from '@/theme';

/**
 * Ecrã de definição de nova palavra-passe. Mostrado quando o utilizador abre a
 * app pelo link de recuperação de email (evento PASSWORD_RECOVERY do Supabase).
 */
export function EcraNovaPalavra() {
  const insets = useSafeAreaInsets();
  const { definirNovaPalavra, sair } = useAuth();

  const [palavra, setPalavra] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const curta = palavra.length > 0 && palavra.length < 6;
  const naoCoincide = confirmar.length > 0 && confirmar !== palavra;
  const valido = palavra.length >= 6 && confirmar === palavra;

  async function guardar() {
    if (!valido || aProcessar) return;
    setAProcessar(true);
    setErro(null);
    const e = await definirNovaPalavra(palavra);
    if (e) {
      setErro(e);
      setAProcessar(false);
    }
    // Em caso de sucesso, `emRecuperacao` passa a false no contexto e o portão
    // de autenticação troca para a app sozinho.
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}>
          <LinearGradient
            colors={[colors.headerFrom, colors.headerTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingTop: insets.top + spacing.xxl,
              paddingBottom: spacing.xxl,
              paddingHorizontal: spacing.lg,
              borderBottomLeftRadius: radii.xl,
              borderBottomRightRadius: radii.xl,
              alignItems: 'center',
            }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: radii.pill,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}>
              <Icon name="lock-reset" size={48} color={colors.textOnDark} />
            </View>
            <Text variant="display" color={colors.textOnDark}>
              Nova palavra-passe
            </Text>
            <Text variant="body" color={colors.textOnDarkMuted} style={{ marginTop: 2 }}>
              Escolha uma nova palavra-passe
            </Text>
          </LinearGradient>

          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
            <Campo
              label="Nova palavra-passe"
              icon="lock-outline"
              value={palavra}
              onChangeText={setPalavra}
              placeholder="Mínimo 6 caracteres"
            />
            <Campo
              label="Confirmar palavra-passe"
              icon="lock-check-outline"
              value={confirmar}
              onChangeText={setConfirmar}
              placeholder="Repita a palavra-passe"
            />

            {curta ? (
              <Aviso texto="A palavra-passe deve ter pelo menos 6 caracteres." />
            ) : naoCoincide ? (
              <Aviso texto="As palavras-passe não coincidem." />
            ) : erro ? (
              <Aviso texto={erro} />
            ) : null}

            <Button
              label="Guardar nova palavra-passe"
              icon="check"
              onPress={guardar}
              disabled={!valido}
              loading={aProcessar}
            />

            <Pressable
              onPress={() => void sair()}
              accessibilityRole="button"
              style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.xs }}>
              <Text variant="body" color={colors.textSecondary}>
                Cancelar
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
      <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
      <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
        {texto}
      </Text>
    </View>
  );
}

function Campo({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text variant="label" style={{ marginBottom: spacing.xs }}>
        {label}
      </Text>
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
        <Icon name={icon} size="md" color={colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
        />
      </View>
    </View>
  );
}
