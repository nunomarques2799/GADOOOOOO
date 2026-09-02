import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalPapeis } from '@/components/ModalPapeis';
import { Button, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { entraPorCodigo, intencoes, type Intencao } from '@/data/intencao';
import { t } from '@/i18n';
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
  /**
   * A palavra-passe escrita a segundo. Só existe no REGISTO: a quem entra não
   * se pede duas vezes, porque quem se engana descobre-o no mesmo instante. No
   * registo não descobre — fica com uma conta cuja palavra-passe não conhece, e
   * o caminho de volta é o email de recuperação.
   */
  const [palavra2, setPalavra2] = useState('');
  const [intencao, setIntencao] = useState<Intencao | null>(null);
  const [aProcessar, setAProcessar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState(false);
  const [recuperado, setRecuperado] = useState(false);
  const [papeisAbertos, setPapeisAbertos] = useState(false);

  const registo = modo === 'registar';
  const recuperar = modo === 'recuperar';
  /**
   * Só se aponta o erro quando já há alguma coisa escrita no segundo campo. A
   * meio de escrever, as duas são sempre diferentes, e um aviso a piscar a cada
   * letra é ruído a dizer que está tudo mal quando ainda não está nada.
   */
  const naoBatem = registo && palavra2.length > 0 && palavra !== palavra2;
  const valido =
    email.trim().length > 3 &&
    email.includes('@') &&
    (recuperar || palavra.length >= 6) &&
    (!registo || (nome.trim().length > 0 && intencao !== null && palavra === palavra2));

  function irPara(novo: Modo) {
    setModo(novo);
    setErro(null);
    setConfirmacao(false);
    setRecuperado(false);
    // A repetição não sobrevive à troca de modo: quem foi a "entrar" e voltou
    // encontrava-a preenchida com o que escreveu antes, a dar por boa uma
    // confirmação que já não confirmou nada.
    setPalavra2('');
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
              {recuperar
                ? t('login.recuperarAcesso')
                : registo
                  ? t('login.criarConta')
                  : t('login.entrarNaConta')}
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
                  {t('login.oQueVeioFazer')}
                </Text>
                <View style={{ gap: spacing.xs }}>
                  {intencoes().map((op) => (
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
                {/* Quatro descrições de uma linha não explicam quem convida
                    quem, e é isso que decide o caminho da conta. O desenho
                    fica atrás de um toque para não empurrar o formulário para
                    fora do ecrã de quem já sabe o que veio cá fazer. */}
                <Pressable
                  onPress={() => setPapeisAbertos(true)}
                  accessibilityRole="button"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    alignSelf: 'flex-start',
                    marginTop: spacing.sm,
                    paddingVertical: spacing.xs,
                  }}>
                  <Icon name="help-circle-outline" size="md" color={colors.primary} />
                  <Text variant="secondary" color={colors.primary}>
                    {t('login.verOQueCadaUmFaz')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {registo ? (
              <Campo
                label={t('login.nome')}
                icon="account-outline"
                value={nome}
                onChangeText={setNome}
                placeholder={t('login.nomePlaceholder')}
                autoCapitalize="words"
              />
            ) : null}
            <Campo
              label={t('login.email')}
              icon="email-outline"
              value={email}
              onChangeText={setEmail}
              placeholder={t('login.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {!recuperar ? (
              <Campo
                label={t('login.palavraPasse')}
                icon="lock-outline"
                value={palavra}
                onChangeText={setPalavra}
                placeholder={t('login.palavraPassePlaceholder')}
                secureTextEntry
              />
            ) : null}
            {registo ? (
              <Campo
                label={t('login.confirmarPalavraPasse')}
                icon="lock-check-outline"
                value={palavra2}
                onChangeText={setPalavra2}
                placeholder={t('login.confirmarPalavraPassePlaceholder')}
                secureTextEntry
                // O aviso vive colado ao campo, e não no erro geral lá em baixo:
                // é aqui que se corrige, e mandar a pessoa procurar a razão ao
                // fundo do ecrã era pior do que não a dizer.
                aviso={naoBatem ? t('login.palavrasNaoBatem') : undefined}
              />
            ) : null}
            {recuperar ? (
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
                {t('login.explicacaoRecuperar')}
              </Text>
            ) : null}

            {modo === 'entrar' ? (
              <Pressable
                onPress={() => irPara('recuperar')}
                accessibilityRole="button"
                style={{ marginTop: -spacing.sm, marginBottom: spacing.md, alignSelf: 'flex-start', paddingVertical: spacing.xs }}>
                <Text variant="secondary" color={colors.primary}>
                  {t('login.esqueciMe')}
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
                    ? t('login.recuperadoAviso')
                    : entraPorCodigo(intencao ?? undefined)
                      ? t('login.contaCriadaComCodigo')
                      : t('login.contaCriada')}
                </Text>
              </View>
            ) : null}

            <Button
              label={
                recuperar
                  ? t('login.enviarLink')
                  : registo
                    ? t('login.criarContaBotao')
                    : t('login.entrar')
              }
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
                  {t('login.voltarAEntrar')}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={trocarModo}
                accessibilityRole="button"
                style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.xs }}>
                <Text variant="body" color={colors.textSecondary}>
                  {registo ? t('login.jaTemConta') : t('login.aindaNaoTemConta')}{' '}
                  <Text variant="bodyStrong" color={colors.primary}>
                    {registo ? t('login.entrar') : t('login.criarContaBotao')}
                  </Text>
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalPapeis visivel={papeisAbertos} onFechar={() => setPapeisAbertos(false)} />
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
  aviso,
}: {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  /** O que está mal NESTE campo. Pinta a moldura e escreve por baixo. */
  aviso?: string;
}) {
  return (
    <View style={{ marginBottom: aviso ? spacing.md : spacing.lg }}>
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
          borderColor: aviso ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
        }}>
        <Icon name={icon} size="md" color={aviso ? colors.danger : colors.textMuted} />
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
      {aviso ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.xs,
          }}>
          <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
          <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
            {aviso}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
