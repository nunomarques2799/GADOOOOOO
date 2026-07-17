import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Field, Header, Icon, TextField, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { avisar } from '@/data/avisos';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, shadow, spacing } from '@/theme';

/**
 * Editar nome e email da conta. Mudar o email não é imediato: o Supabase envia
 * um link de confirmação para o endereço novo — só quando o utilizador o abrir
 * é que a troca fica em vigor. Explicamos isso ao guardar.
 */
export default function EditarDadosPessoaisScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { utilizador, configurado, atualizarPerfil } = useAuth();

  const nomeInicial = ((utilizador?.user_metadata?.nome as string | undefined) ?? '').trim();
  const emailInicial = utilizador?.email ?? '';

  const [nome, setNome] = useState(nomeInicial);
  const [email, setEmail] = useState(emailInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const emailValido = /.+@.+\..+/.test(email.trim());
  const alterou = nome.trim() !== nomeInicial || email.trim().toLowerCase() !== emailInicial.toLowerCase();
  const valido = configurado && nome.trim().length > 0 && emailValido && alterou;

  async function guardar() {
    if (!valido || aGuardar) return;
    setAGuardar(true);
    setErro(null);
    const r = await atualizarPerfil(nome, email);
    setAGuardar(false);
    if ('erro' in r) {
      setErro(r.erro);
      return;
    }
    if (r.confirmarEmail) {
      avisar(
        'Confirme o novo email',
        `Enviámos um link de confirmação para ${email.trim()}. Só depois de o abrir é que a troca de email fica em vigor.`,
      );
    } else {
      avisar('Dados atualizados', 'As alterações foram guardadas.');
    }
    router.back();
  }

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Editar dados pessoais" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: sizes.botaoFixo + insets.bottom + spacing.xl,
        }}>
        <View style={conteudo}>
          <Text
            variant="secondary"
            color={colors.textSecondary}
            style={{ marginBottom: spacing.md }}>
            Nome e email associados à sua conta. Os animais e explorações não são afetados.
          </Text>

          <Field label="Nome" obrigatorio>
            <TextField
              value={nome}
              onChangeText={setNome}
              placeholder="O seu nome"
              icon="account"
              autoCapitalize="words"
              autoComplete="name"
            />
          </Field>

          <Field
            label="Email"
            obrigatorio
            ajuda="Ao mudar de email vamos enviar um link de confirmação para o endereço novo — só nessa altura é que a troca fica ativa.">
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemplo.pt"
              icon="email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
          </Field>

          {!configurado ? (
            <Card style={{ marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name="information-outline" size="md" color={colors.info} />
                <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                  Esta app está em modo offline. Para alterar os dados da conta é
                  preciso iniciar sessão.
                </Text>
              </View>
            </Card>
          ) : null}

          {erro ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: spacing.xs,
                backgroundColor: colors.dangerTint,
                padding: spacing.sm,
                borderRadius: radii.md,
                marginTop: spacing.md,
              }}>
              <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
              <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                {erro}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Botão fixo em baixo — o mesmo padrão dos formulários existentes. */}
      <View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            alignItems: 'center',
          },
          shadow.lg,
        ]}>
        <View style={{ width: '100%', maxWidth: desktop ? layout.conteudoEstreito : undefined }}>
          <Button
            label="Guardar alterações"
            icon="check"
            onPress={() => void guardar()}
            disabled={!valido}
            loading={aGuardar}
          />
        </View>
      </View>
    </View>
  );
}

/** Altura reservada em baixo para a barra do botão não tapar conteúdo. */
const sizes = { botaoFixo: 80 };
