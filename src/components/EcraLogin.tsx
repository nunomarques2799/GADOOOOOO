import { Children, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotoesLoginExterno } from '@/components/BotoesLoginExterno';
import { Logotipo } from '@/components/Logotipo';
import { ModalPapeis } from '@/components/ModalPapeis';
import { Button, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { entraPorCodigo, intencoes, type Intencao } from '@/data/intencao';
import { codigoSmsValido, normalizarTelemovel, type MetodoLogin } from '@/data/loginExterno';
import { t } from '@/i18n';
import { useColunas, useDesktop } from '@/hooks/useDesktop';
import { colors, fontFamily, radii, shadow, sizes, spacing } from '@/theme';

/**
 * `telemovel` é a única que tem DOIS passos no mesmo modo: escreve-se o número,
 * chega um código por SMS, escreve-se o código. O `codigoPedido` é que diz em
 * qual dos dois se está — um modo a mais para o segundo passo obrigava a
 * duplicar o cabeçalho e o rodapé por causa de um campo.
 */
type Modo = 'entrar' | 'registar' | 'recuperar' | 'telemovel';

/** Ecrã de entrada — mostrado quando há Supabase configurado mas sem sessão. */
export function EcraLogin() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const colunas = useColunas();
  const { entrar, registar, recuperarPalavra, entrarCom, pedirCodigoSms, entrarComCodigoSms } =
    useAuth();

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
  /** O número, tal como foi escrito. A normalização é feita ao enviar. */
  const [telemovel, setTelemovel] = useState('');
  const [codigoSms, setCodigoSms] = useState('');
  /** Já foi pedido o SMS? É isso que troca o campo do número pelo do código. */
  const [codigoPedido, setCodigoPedido] = useState(false);

  const registo = modo === 'registar';
  const recuperar = modo === 'recuperar';
  const porTelemovel = modo === 'telemovel';
  /**
   * Só se aponta o erro quando já há alguma coisa escrita no segundo campo. A
   * meio de escrever, as duas são sempre diferentes, e um aviso a piscar a cada
   * letra é ruído a dizer que está tudo mal quando ainda não está nada.
   */
  const naoBatem = registo && palavra2.length > 0 && palavra !== palavra2;
  /** O número em E.164, ou `null` se ainda não dá para aproveitar nada. */
  const numeroPronto = porTelemovel ? normalizarTelemovel(telemovel) : null;
  const valido = porTelemovel
    ? codigoPedido
      ? codigoSmsValido(codigoSms)
      : numeroPronto !== null
    : email.trim().length > 3 &&
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
    // O código do SMS também não: um código velho no campo dava um "código
    // inválido" a quem acabou de pedir um novo.
    setCodigoSms('');
    setCodigoPedido(false);
  }

  /** Uma das outras portas: Google e Apple entram já, o telemóvel abre o modo. */
  async function escolherMetodo(metodo: MetodoLogin) {
    if (metodo === 'telemovel') {
      irPara('telemovel');
      return;
    }
    setAProcessar(true);
    setErro(null);
    const e = await entrarCom(metodo);
    setAProcessar(false);
    if (e) setErro(e);
    // Sem erro e sem sessão quer dizer que a pessoa desistiu a meio. Não se diz
    // nada: ela sabe o que fez, e um aviso a seguir a um cancelamento lê-se
    // como se a app tivesse falhado.
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

    if (porTelemovel) {
      if (!codigoPedido) {
        // O `numeroPronto` não pode ser nulo aqui (o `valido` já o exigiu), mas
        // o `??` evita mandar a string vazia ao servidor se um dia deixar de ser
        // verdade.
        const e = await pedirCodigoSms(numeroPronto ?? '');
        if (e) setErro(e);
        else setCodigoPedido(true);
      } else {
        const e = await entrarComCodigoSms(numeroPronto ?? '', codigoSms);
        if (e) setErro(e);
        // Sem erro, a sessão abre e o portão de autenticação troca o ecrã.
      }
    } else if (recuperar) {
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

  /** O que se está a fazer neste ecrã, dito por baixo da marca. */
  const subtitulo = recuperar
    ? t('login.recuperarAcesso')
    : registo
      ? t('login.criarConta')
      : porTelemovel
        ? t('login.entrarNaConta')
        : t('login.lema');

  /** No registo do computador, os campos vão aos pares (ver `LadoALado`). */
  const lado = colunas && registo;

  const formulario = (
          <View
            style={{
              // No computador o formulário já vem dentro da sua coluna (ver
              // `EcraLoginDesktop`), e as margens são dela.
              paddingHorizontal: desktop ? 0 : spacing.lg,
              paddingTop: spacing.xl,
            }}>
            {/*
              A pergunta vem ANTES do nome de propósito: é ela que decide o que
              acontece a seguir a criar a conta (esperar por aprovação, ou pedir
              um código de convite ao dono da exploração — ver `intencao.ts`).
            */}
            {porTelemovel ? (
              <>
                {!codigoPedido ? (
                  <>
                    <Campo
                      label={t('login.telemovel')}
                      icon="cellphone"
                      value={telemovel}
                      onChangeText={setTelemovel}
                      placeholder={t('login.telemovelPlaceholder')}
                      autoCapitalize="none"
                      keyboardType="phone-pad"
                      // Só se aponta o engano depois de haver o suficiente para
                      // julgar: a piscar a cada dígito, dizia "número inválido"
                      // a quem ainda vai no terceiro.
                      aviso={
                        telemovel.replace(/\D/g, '').length >= 9 && !numeroPronto
                          ? t('login.telemovelInvalido')
                          : undefined
                      }
                    />
                    <Text
                      variant="secondary"
                      color={colors.textSecondary}
                      style={{ marginTop: -spacing.sm, marginBottom: spacing.lg }}>
                      {t('login.telemovelExplicacao')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Campo
                      label={t('login.codigoSms')}
                      icon="message-text-outline"
                      value={codigoSms}
                      onChangeText={setCodigoSms}
                      placeholder={t('login.codigoSmsPlaceholder')}
                      autoCapitalize="none"
                      keyboardType="number-pad"
                    />
                    <Text
                      variant="secondary"
                      color={colors.textSecondary}
                      style={{ marginTop: -spacing.sm, marginBottom: spacing.lg }}>
                      {t('login.codigoEnviadoPara', { numero: numeroPronto ?? telemovel })}
                    </Text>
                  </>
                )}
              </>
            ) : null}
            {registo ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text variant="label" style={{ marginBottom: spacing.xs }}>
                  {t('login.oQueVeioFazer')}
                </Text>
                {/* No computador, em grelha de duas: quatro cartões empilhados
                    empurravam o botão de criar conta para fora da janela. */}
                <View style={{ gap: spacing.xs, flexDirection: lado ? 'row' : 'column', flexWrap: 'wrap' }}>
                  {intencoes().map((op) => (
                    <View key={op.id} style={lado ? { flexBasis: '40%', flexGrow: 1 } : undefined}>
                      <OpcaoIntencao
                        rotulo={op.rotulo}
                        descricao={op.descricao}
                        icone={op.icone}
                        escolhida={intencao === op.id}
                        onPress={() => setIntencao(op.id)}
                      />
                    </View>
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
            <LadoALado ativo={lado}>
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
            {!porTelemovel ? (
              <Campo
                label={t('login.email')}
                icon="email-outline"
                value={email}
                onChangeText={setEmail}
                placeholder={t('login.emailPlaceholder')}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            ) : null}
            </LadoALado>
            <LadoALado ativo={lado}>
            {!recuperar && !porTelemovel ? (
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
            </LadoALado>
            {recuperar ? (
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
                {t('login.explicacaoRecuperar')}
              </Text>
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
                porTelemovel
                  ? codigoPedido
                    ? t('login.confirmarCodigo')
                    : t('login.enviarCodigo')
                  : recuperar
                    ? t('login.enviarLink')
                    : registo
                      ? t('login.criarContaBotao')
                      : t('login.entrar')
              }
              icon={
                porTelemovel
                  ? codigoPedido
                    ? 'login'
                    : 'message-text-outline'
                  : recuperar
                    ? 'email-fast-outline'
                    : registo
                      ? 'account-plus'
                      : // "Entrar" sozinho, como no guia: é a palavra que se procura.
                        undefined
              }
              onPress={submeter}
              disabled={!valido}
              loading={aProcessar}
            />

            {/* Por baixo do Entrar e ao meio, como no guia: é a saída para quem
                carregou e não entrou, e é aí que a pessoa está a olhar. */}
            {modo === 'entrar' ? (
              <Pressable
                onPress={() => irPara('recuperar')}
                accessibilityRole="button"
                style={{ marginTop: spacing.md, alignSelf: 'center', paddingVertical: spacing.xs }}>
                <Text variant="bodyStrong" color={colors.primary}>
                  {t('login.esqueciMe')}
                </Text>
              </Pressable>
            ) : null}

            {/* As outras portas so aparecem em "entrar": no registo o que decide
                o caminho da conta e a pergunta de cima, e a recuperar so ha uma
                coisa a fazer. */}
            {modo === 'entrar' ? (
              <BotoesLoginExterno aProcessar={aProcessar} onEscolher={escolherMetodo} />
            ) : null}

            {recuperar || porTelemovel ? (
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
  );

  if (desktop) {
    return (
      <>
        <EcraLoginDesktop
          titulo={registo ? t('login.criarConta') : recuperar ? t('login.recuperarAcesso') : t('login.entrarNaConta')}
          largo={registo}>
          {formulario}
        </EcraLoginDesktop>
        <ModalPapeis visivel={papeisAbertos} onFechar={() => setPapeisAbertos(false)} />
      </>
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
          {/* A marca, sozinha no creme: o logótipo, o nome em Fraunces e a
              frase. Era um cabeçalho verde com a vaca da biblioteca de ícones;
              o guia de estilo pôs aqui o logótipo de verdade. */}
          <View
            style={{
              alignItems: 'center',
              paddingTop: insets.top + spacing.xxxl,
              paddingHorizontal: spacing.lg,
            }}>
            <Logotipo tamanho={124} sombra />
            <Text
              variant="display"
              center
              style={{ fontSize: 44, lineHeight: 50, marginTop: spacing.xl }}
              maxFontSizeMultiplier={1.1}>
              Terrabovina
            </Text>
            <Text variant="bodyLg" color={colors.textSecondary} center style={{ marginTop: spacing.xs }}>
              {subtitulo}
            </Text>
          </View>

          {formulario}
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalPapeis visivel={papeisAbertos} onFechar={() => setPapeisAbertos(false)} />
    </View>
  );
}

/**
 * A entrada no COMPUTADOR: a marca de um lado, o formulário do outro.
 * ------------------------------------------------------------------
 * Era o ecrã do telemóvel numa tira de 760px ao meio do monitor, com duas
 * bandas cinzentas dos lados: parecia a app aberta com a janela mal esticada.
 * Num ecrã largo, a entrada é a primeira página que se vê, e é a página onde a
 * app se apresenta a quem chega pela primeira vez. À esquerda fica a marca, na
 * cor da paleta, com a frase e as três coisas que a app faz; à direita, no
 * creme, o formulário numa coluna da largura de um formulário (os campos não
 * ganham nada com 900px de largura).
 *
 * Abaixo de ~1100px o painel da marca encolhe, mas não desaparece: o mínimo do
 * desenho de desktop são 900px e cabem os dois.
 */
export function EcraLoginDesktop({
  titulo,
  largo,
  children,
}: {
  titulo: string;
  /** O registo, que tem mais para preencher e vai em grelha. */
  largo: boolean;
  children: ReactNode;
}) {
  const pontos: { icone: IconName; texto: string }[] = [
    { icone: 'calendar-check-outline', texto: t('login.painelPrazos') },
    { icone: 'cloud-off-outline', texto: t('login.painelSemRede') },
    { icone: 'account-group-outline', texto: t('login.painelEquipa') },
  ];
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <View
        style={{
          width: '44%',
          minWidth: 380,
          maxWidth: 640,
          backgroundColor: colors.primary,
          paddingHorizontal: spacing.xxxl,
          paddingVertical: spacing.xxl,
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}>
        {/* Curvas de nível, ao canto: três círculos de traço fino, como as
            linhas de um mapa de terreno. Enfeite puro, por isso sem toques e
            escondidos do leitor de ecrã. */}
        {[760, 560, 360].map((d) => (
          <View
            key={d}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              width: d,
              height: d,
              right: -d / 2 + 60,
              bottom: -d / 2 + 40,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: colors.textOnDarkMuted,
              opacity: 0.18,
            }}
          />
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Logotipo tamanho={56} />
          <Text variant="h2" color={colors.textOnDark}>
            Terrabovina
          </Text>
        </View>

        <View style={{ maxWidth: 480 }}>
          <Text
            variant="display"
            color={colors.textOnDark}
            style={{ fontSize: 44, lineHeight: 52 }}
            maxFontSizeMultiplier={1.1}>
            {t('login.lema')}
          </Text>
          <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
            {pontos.map((p) => (
              <View key={p.icone} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radii.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.textOnDarkMuted,
                  }}>
                  <Icon name={p.icone} size="md" color={colors.textOnDark} />
                </View>
                <Text variant="bodyLg" color={colors.textOnDarkMuted} style={{ flex: 1 }}>
                  {p.texto}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text variant="caption" color={colors.textOnDarkMuted}>
          {t('login.painelRodape')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.xxl,
          paddingVertical: spacing.xxl,
        }}>
        <View style={{ width: '100%', maxWidth: largo ? 640 : 460 }}>
          <Text variant="display">{titulo}</Text>
          {children}
        </View>
      </ScrollView>
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
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  secureTextEntry?: boolean;
  /** O que está mal NESTE campo. Pinta a moldura e escreve por baixo. */
  aviso?: string;
}) {
  // O campo onde se escreve leva a linha da marca, como no guia.
  const [focado, setFocado] = useState(false);
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
          borderColor: aviso ? colors.danger : focado ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
        }}>
        {/* O ícone só aparece para dizer o que está mal: o rótulo por cima já
            diz o que é o campo, e o guia deixa-os limpos. */}
        {aviso ? <Icon name={icon} size="md" color={colors.danger} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCorrect={false}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: 18, color: colors.text }}
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

/**
 * Dois campos na mesma linha (nome e email, as duas palavras-passe), só no
 * registo do computador. Desligado, não acrescenta nada à árvore.
 */
function LadoALado({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  if (!ativo) return <>{children}</>;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {Children.toArray(children).map((filho, i) => (
        <View key={i} style={{ flex: 1 }}>
          {filho}
        </View>
      ))}
    </View>
  );
}
