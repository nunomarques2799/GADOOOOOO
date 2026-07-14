import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

type Modo = 'entrar' | 'registar';

/** Ecrã de entrada — mostrado quando há Supabase configurado mas sem sessão. */
export function EcraLogin() {
  const insets = useSafeAreaInsets();
  const { entrar, registar } = useAuth();

  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [palavra, setPalavra] = useState('');
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState(false);

  const registo = modo === 'registar';
  const valido =
    email.trim().length > 3 &&
    email.includes('@') &&
    palavra.length >= 6 &&
    (!registo || nome.trim().length > 0);

  function trocarModo() {
    setModo(registo ? 'entrar' : 'registar');
    setErro(null);
    setConfirmacao(false);
  }

  async function submeter() {
    if (!valido || aProcessar) return;
    setAProcessar(true);
    setErro(null);
    setConfirmacao(false);

    if (registo) {
      const r = await registar(email, palavra, nome);
      if ('erro' in r) setErro(r.erro);
      else if (r.confirmarEmail) setConfirmacao(true);
      // se criou sessão, o portão de autenticação troca para a app sozinho
    } else {
      const e = await entrar(email, palavra);
      if (e) setErro(e);
    }
    setAProcessar(false);
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
          {/* Cabeçalho verde */}
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
              <Icon name="cow" size={48} color={colors.textOnDark} />
            </View>
            <Text variant="display" color={colors.textOnDark}>
              Gestão de Gado
            </Text>
            <Text variant="body" color={colors.textOnDarkMuted} style={{ marginTop: 2 }}>
              {registo ? 'Criar a sua conta' : 'Entrar na sua conta'}
            </Text>
          </LinearGradient>

          {/* Formulário */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
            {registo ? (
              <Campo
                label="Nome"
                icon="account-outline"
                value={nome}
                onChangeText={setNome}
                placeholder="O seu nome"
                autoCapitalize="words"
              />
            ) : null}
            <Campo
              label="Email"
              icon="email-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="nome@exemplo.pt"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Campo
              label="Palavra-passe"
              icon="lock-outline"
              value={palavra}
              onChangeText={setPalavra}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
            />

            {erro ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
                <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
                <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                  {erro}
                </Text>
              </View>
            ) : null}

            {confirmacao ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.xs,
                  alignItems: 'flex-start',
                  backgroundColor: colors.successTint,
                  borderRadius: radii.md,
                  padding: spacing.sm,
                  marginBottom: spacing.md,
                }}>
                <Icon name="email-check-outline" size="md" color={colors.success} />
                <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                  Conta criada. Enviámos um email de confirmação — confirme e depois entre.
                </Text>
              </View>
            ) : null}

            <Button
              label={registo ? 'Criar conta' : 'Entrar'}
              icon={registo ? 'account-plus' : 'login'}
              onPress={submeter}
              disabled={!valido}
              loading={aProcessar}
            />

            <Pressable
              onPress={trocarModo}
              accessibilityRole="button"
              style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.xs }}>
              <Text variant="body" color={colors.textSecondary}>
                {registo ? 'Já tem conta? ' : 'Ainda não tem conta? '}
                <Text variant="bodyStrong" color={colors.primary}>
                  {registo ? 'Entrar' : 'Criar conta'}
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Campo({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
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
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCorrect={false}
          style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
        />
      </View>
    </View>
  );
}
