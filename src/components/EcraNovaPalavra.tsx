import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EcraLoginDesktop } from '@/components/EcraLogin';
import { Logotipo } from '@/components/Logotipo';
import { Button, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, fontFamily, radii, sizes, spacing } from '@/theme';

/**
 * Ecrã de definição de nova palavra-passe. Mostrado quando o utilizador abre a
 * app pelo link de recuperação de email (evento PASSWORD_RECOVERY do Supabase).
 */
export function EcraNovaPalavra() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
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

  const formulario = (
    <View style={{ paddingHorizontal: desktop ? 0 : spacing.lg, paddingTop: spacing.xl }}>
      <Campo
        label={t('novaPalavra.titulo')}
        icon="lock-outline"
        value={palavra}
        onChangeText={setPalavra}
        placeholder={t('login.palavraPassePlaceholder')}
      />
      <Campo
        label={t('novaPalavra.confirmar')}
        icon="lock-check-outline"
        value={confirmar}
        onChangeText={setConfirmar}
        placeholder={t('novaPalavra.repita')}
      />

      {curta ? (
        <Aviso texto={t('novaPalavra.curta')} />
      ) : naoCoincide ? (
        <Aviso texto={t('novaPalavra.naoCoincidem')} />
      ) : erro ? (
        <Aviso texto={erro} />
      ) : null}

      <Button
        label={t('novaPalavra.guardar')}
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
          {t('comum.cancelar')}
        </Text>
      </Pressable>
    </View>
  );

  // No computador, a mesma moldura da entrada: a marca de um lado e o
  // formulário do outro (ver `EcraLoginDesktop`).
  if (desktop) {
    return (
      <EcraLoginDesktop titulo={t('novaPalavra.titulo')} largo={false}>
        <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
          {t('novaPalavra.subtitulo')}
        </Text>
        {formulario}
      </EcraLoginDesktop>
    );
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
          {/* A marca no creme, como no ecrã de entrada. Era um cabeçalho verde
              em degradê com um cadeado, do desenho de antes da marca nova. */}
          <View
            style={{
              alignItems: 'center',
              paddingTop: insets.top + spacing.xxxl,
              paddingHorizontal: spacing.lg,
            }}>
            <Logotipo tamanho={96} sombra />
            <Text variant="display" center style={{ marginTop: spacing.lg }}>
              {t('novaPalavra.titulo')}
            </Text>
            <Text variant="body" color={colors.textSecondary} center style={{ marginTop: 2 }}>
              {t('novaPalavra.subtitulo')}
            </Text>
          </View>

          {formulario}
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
          style={{ flex: 1, fontFamily: fontFamily.medium, fontSize: 17, color: colors.text }}
        />
      </View>
    </View>
  );
}
