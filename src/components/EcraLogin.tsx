import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { entraPorCodigo, INTENCOES, type Intencao } from '@/data/intencao';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

type Modo = 'entrar' | 'registar' | 'recuperar';

/** Ecrã de entrada — mostrado quando há Supabase configurado mas sem sessão. */
export function EcraLogin() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { entrar, registar, recuperarPalavra } = useAuth();

  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [palavra, setPalavra] = useState('');
  const [intencao, setIntencao] = useState<Intencao | null>(null);
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState(false);
  const [recuperado, setRecuperado] = useState(false);

  const registo = modo === 'registar';
  const recuperar = modo === 'recuperar';
  const valido =
    email.trim().length > 3 &&
    email.includes('@') &&
    (recuperar || palavra.length >= 6) &&
    (!registo || (nome.trim().length > 0 && intencao !== null));

  function irPara(novo: Modo) {
    setModo(novo);
    setErro(null);
    setConfirmacao(false);
    setRecuperado(false);
  }

  function trocarModo() {
    irPara(registo ? 'entrar' : 'registar');
  }

  async function submeter() {
    if (!valido || aProcessar) return;
    setAProcessar(true);
    setErro(null);
    setConfirmacao(false);
    setRecuperado(false);

    if (recuperar) {
      const e = await recuperarPalavra(email);
      if (e) setErro(e);
      else setRecuperado(true);
    } else if (registo) {
      const r = await registar(email, palavra, nome, intencao ?? undefined);
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
          contentContainerStyle={{
            flexGrow: 1,
            // No computador o formulário fica ao meio da janela em vez de
            // encostado ao topo, com o resto do ecrã vazio por baixo.
            justifyContent: desktop ? 'center' : 'flex-start',
            paddingVertical: desktop ? spacing.xl : 0,
          }}>
          {/* Cabeçalho verde */}
          <LinearGradient
            colors={[colors.headerFrom, colors.headerTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              // No telemóvel encosta ao topo (e passa por baixo da barra de
              // estado); no computador é um cartão solto, arredondado dos
              // quatro lados, com margem à volta.
              paddingTop: desktop ? spacing.xxl : insets.top + spacing.xxl,
              paddingBottom: spacing.xxl,
              paddingHorizontal: spacing.lg,
              marginHorizontal: desktop ? spacing.xl : 0,
              borderTopLeftRadius: desktop ? radii.xl : 0,
              borderTopRightRadius: desktop ? radii.xl : 0,
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
              Terrabovina
            </Text>
            <Text variant="body" color={colors.textOnDarkMuted} style={{ marginTop: 2 }}>
              {recuperar ? 'Recuperar o acesso' : registo ? 'Criar a sua conta' : 'Entrar na sua conta'}
            </Text>
          </LinearGradient>

          {/* Formulário */}
          <View
            style={{
              paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
              paddingTop: spacing.xl,
            }}>
            {/*
              A pergunta vem ANTES do nome de propósito: é ela que decide o que
              acontece a seguir a criar a conta (esperar por aprovação, ou pedir
              um código de convite ao dono da exploração — ver `intencao.ts`).
            */}
            {registo ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text variant="label" style={{ marginBottom: spacing.xs }}>
                  O que veio cá fazer?
                </Text>
                <View style={{ gap: spacing.xs }}>
                  {INTENCOES.map((op) => (
                    <OpcaoIntencao
                      key={op.id}
                      rotulo={op.rotulo}
                      descricao={op.descricao}
                      icone={op.icone}
                      escolhida={intencao === op.id}
                      onPress={() => setIntencao(op.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
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
            {!recuperar ? (
              <Campo
                label="Palavra-passe"
                icon="lock-outline"
                value={palavra}
                onChangeText={setPalavra}
                placeholder="Mínimo 6 caracteres"
                secureTextEntry
              />
            ) : (
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
                Enviamos-lhe um email com um link para definir uma nova palavra-passe.
              </Text>
            )}

            {modo === 'entrar' ? (
              <Pressable
                onPress={() => irPara('recuperar')}
                accessibilityRole="button"
                style={{ marginTop: -spacing.sm, marginBottom: spacing.md, alignSelf: 'flex-start', paddingVertical: spacing.xs }}>
                <Text variant="secondary" color={colors.primary}>
                  Esqueci-me da palavra-passe
                </Text>
              </Pressable>
            ) : null}

            {erro ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
                <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
                <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                  {erro}
                </Text>
              </View>
            ) : null}

            {confirmacao || recuperado ? (
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
                  {recuperado
                    ? 'Se existir uma conta com este email, enviámos um link para redefinir a palavra-passe. Verifique a caixa de entrada.'
                    : entraPorCodigo(intencao ?? undefined)
                      ? 'Conta criada. Enviámos um email de confirmação: confirme, entre, e use o código de convite que lhe deram.'
                      : 'Conta criada. Enviámos um email de confirmação: confirme e depois entre.'}
                </Text>
              </View>
            ) : null}

            <Button
              label={recuperar ? 'Enviar link de recuperação' : registo ? 'Criar conta' : 'Entrar'}
              icon={recuperar ? 'email-fast-outline' : registo ? 'account-plus' : 'login'}
              onPress={submeter}
              disabled={!valido}
              loading={aProcessar}
            />

            {recuperar ? (
              <Pressable
                onPress={() => irPara('entrar')}
                accessibilityRole="button"
                style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.xs }}>
                <Text variant="body" color={colors.primary}>
                  Voltar a entrar
                </Text>
              </Pressable>
            ) : (
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
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Uma das respostas a "o que veio cá fazer?".
 *
 * Linha inteira tocável, com o ícone à esquerda e a marca à direita — o mesmo
 * desenho das listas de opções do resto da app. Não é um `<Picker>` nem uma
 * lista que abre: são três, cabem todas no ecrã, e ver as três lado a lado é o
 * que deixa perceber a diferença entre elas.
 */
function OpcaoIntencao({
  rotulo,
  descricao,
  icone,
  escolhida,
  onPress,
}: {
  rotulo: string;
  descricao: string;
  icone: IconName;
  escolhida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      // O `aria-checked` a acompanhar o `accessibilityState`: no react-native-web
      // desta versão o estado não chega ao DOM sozinho, e um leitor de ecrã
      // anunciava as três opções exatamente da mesma maneira.
      accessibilityState={{ checked: escolhida }}
      aria-checked={escolhida}
      accessibilityLabel={`${rotulo}. ${descricao}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: sizes.touchMin,
          padding: spacing.sm,
          borderRadius: radii.md,
          borderWidth: escolhida ? 2 : 1.5,
          borderColor: escolhida ? colors.primary : colors.border,
          backgroundColor: escolhida ? colors.primaryTint : colors.surface,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon
        name={icone}
        size="lg"
        color={escolhida ? colors.primaryDark : colors.textSecondary}
      />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={escolhida ? colors.primaryDark : colors.text}>
          {rotulo}
        </Text>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: 2 }}>
          {descricao}
        </Text>
      </View>
      <Icon
        name={escolhida ? 'check-circle' : 'circle-outline'}
        size="md"
        color={escolhida ? colors.primary : colors.textMuted}
      />
    </Pressable>
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
