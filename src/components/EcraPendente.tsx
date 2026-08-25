import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CampoLocalidade } from '@/components/CampoLocalidade';
import { Button, Card, Icon, type IconName, Text } from '@/components/ui';
import { confirmacaoValida, PALAVRA_CONFIRMACAO } from '@/data/apagarConta';
import { useAuth } from '@/data/auth';
import { avisar, confirmar } from '@/data/avisos';
import { entraPorCodigo, lerIntencao } from '@/data/intencao';
import { useMembros } from '@/data/membros';
import { explicarRecusa } from '@/data/supabaseRepo';
import { supabase } from '@/data/supabase';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, radii, sizes, spacing } from '@/theme';

/** O que a pessoa escolheu fazer neste ecrã. `null` = ainda não escolheu. */
type Opcao = 'criar' | 'convite';

function novoId(prefixo: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `${prefixo}-${uuid}`;
}

/**
 * Ecrã mostrado a utilizadores autenticados que ainda não têm acesso.
 * ------------------------------------------------------------------
 * O que mostra depende de duas coisas: se a conta já foi aprovada e do que a
 * pessoa disse ser quando se registou (ver `data/intencao.ts`).
 *
 *   - estado='pendente' + dono     → aguarda aprovação do superadmin
 *   - estado='pendente' + equipa   → não espera por ninguém: entra com código
 *   - estado='ativo'   + 0 membros → cria a primeira exploração, ou usa código
 *
 * O ecrã teve durante algum tempo um separador "Aguardar" ao lado dos outros
 * dois. Estava sempre escolhido de origem, e tocar-lhe não fazia nada — parecia
 * um botão avariado. Aqui só há opções que MUDAM alguma coisa; esperar não é
 * uma delas, é o que acontece quando não se escolhe nada.
 */
export function EcraPendente() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { utilizador, sair, apagarConta } = useAuth();
  const { recarregar, aCarregar, estadoPerfil, resgatarConvite } = useMembros();

  const nome = utilizador?.user_metadata?.nome as string | undefined;
  const email = utilizador?.email ?? '';
  const aprovado = estadoPerfil === 'ativo';
  const intencao = lerIntencao(utilizador?.user_metadata);
  const porCodigo = entraPorCodigo(intencao);

  // Quem já disse ao que vem chega aqui com o caminho aberto: o trabalhador e o
  // veterinário no campo do código, o dono aprovado no formulário da
  // exploração. Quem se registou antes de a pergunta existir escolhe agora.
  const [escolha, setEscolha] = useState<Opcao | null>(() => {
    if (porCodigo) return 'convite';
    if (aprovado && intencao === 'dono') return 'criar';
    return null;
  });

  // Formulário de criar exploração (só se aprovado).
  const [nomeExp, setNomeExp] = useState('');
  const [marca, setMarca] = useState('');
  const [nifDetentor, setNif] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [aGravar, setAGravar] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const validoExp = nomeExp.trim() && marca.trim() && nifDetentor.trim();

  // Formulário de resgatar convite.
  const [codigo, setCodigo] = useState('');
  const [aResgatar, setAResgatar] = useState(false);
  const [erroResgate, setErroResgate] = useState<string | null>(null);

  // Apagar a conta a partir DAQUI.
  //
  // A diretriz 5.1.1(v) da Apple obriga quem deixa criar conta a deixar
  // apagá-la de dentro da app. O ecrã que faz isso (`conta/apagar`) vive
  // dentro dos separadores, e quem está neste ecrã não tem separadores
  // nenhuns: o `AppRouter` do `_layout.tsx` monta ISTO em vez da app inteira
  // enquanto `membros.length === 0`. Ou seja, quem se registava ficava com uma
  // conta que só sabia terminar sessão, e a única forma de a apagar era pedir
  // a alguém. Isso é o buraco que esta secção fecha.
  //
  // Note-se que não é só o "pendente": uma conta JÁ APROVADA que ainda não
  // criou exploração nenhuma cai no mesmo ecrã, e tinha o mesmo problema.
  const [aApagar, setAApagar] = useState(false);
  const [querApagar, setQuerApagar] = useState(false);
  const [palavra, setPalavra] = useState('');
  const [erroApagar, setErroApagar] = useState<string | null>(null);
  const podeApagar = confirmacaoValida(palavra) && !aApagar;

  async function criarPrimeiraExploracao() {
    if (!supabase || !validoExp) return;
    setAGravar(true);
    setErroCriar(null);
    const { error } = await supabase.from('exploracao').insert({
      id: novoId('exp'),
      nome: nomeExp.trim(),
      marca_exploracao: marca.trim(),
      nif_detentor: nifDetentor.trim(),
      localizacao: localizacao.trim() || null,
    });
    setAGravar(false);
    if (error) {
      setErroCriar(await explicarRecusa(error.message));
      return;
    }
    await recarregar();
  }

  async function submeterCodigo() {
    if (!codigo.trim()) return;
    setAResgatar(true);
    setErroResgate(null);
    const erro = await resgatarConvite(codigo);
    setAResgatar(false);
    if (erro) setErroResgate(traduzErroConvite(erro));
    // Se OK, `recarregar` dentro de `resgatarConvite` faz o gate desaparecer.
  }

  function perguntarPelaUltimaVez() {
    if (!podeApagar) return;
    // `perguntaSemDados` e não a versão com contagens: quem está neste ecrã não
    // tem exploração nenhuma, portanto não há explorações nem animais para
    // enumerar. É o mesmo texto que o `conta/apagar` usa quando a conta está
    // vazia.
    confirmar(
      t('apagar.perguntaTitulo'),
      t('apagar.perguntaSemDados'),
      () => void executarApagar(),
      { rotuloConfirmar: t('apagar.definitivamente'), destrutivo: true },
    );
  }

  async function executarApagar() {
    setAApagar(true);
    setErroApagar(null);
    const razao = await apagarConta();
    if (razao) {
      // Continua a haver conta: fica-se aqui, com a razão à vista e a palavra
      // ainda escrita. Fechar o formulário seria esconder a falha.
      setAApagar(false);
      setErroApagar(razao);
      return;
    }
    // Sem sessão, o portão do `_layout.tsx` leva a app ao ecrã de entrada
    // sozinho. O aviso é montado por fora dele e sobrevive a essa troca, ao
    // contrário de um toast, que morreria com o ecrã.
    avisar(t('apagar.apagada'), t('apagar.apagadaDetalhe'));
  }

  const titulo = aprovado
    ? t('pendente.bemVindo')
    : porCodigo
      ? t('pendente.faltaCodigo')
      : t('pendente.aAguardar');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.headerFrom, colors.headerTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          // Em janela larga o cabeçalho é uma faixa, não meio ecrã: o mesmo
          // desenho vertical que serve um telemóvel empurrava tudo o que
          // interessa para fora da vista num monitor.
          paddingTop: insets.top + (desktop ? spacing.lg : spacing.xxl),
          paddingBottom: desktop ? spacing.lg : spacing.xxl,
          paddingHorizontal: desktop ? spacing.xl : spacing.lg,
          borderBottomLeftRadius: radii.xl,
          borderBottomRightRadius: radii.xl,
          alignItems: desktop ? 'flex-start' : 'center',
        }}>
        <View
          style={{
            flexDirection: desktop ? 'row' : 'column',
            alignItems: 'center',
            gap: desktop ? spacing.md : 0,
            alignSelf: 'stretch',
          }}>
          <View
            style={{
              width: desktop ? 60 : 84,
              height: desktop ? 60 : 84,
              borderRadius: radii.pill,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: desktop ? 0 : spacing.sm,
            }}>
            <Icon
              name={aprovado ? 'barn' : porCodigo ? 'ticket-confirmation-outline' : 'clock-outline'}
              size={desktop ? 32 : 48}
              color={colors.textOnDark}
            />
          </View>
          <View style={{ flex: desktop ? 1 : undefined, alignItems: desktop ? 'flex-start' : 'center' }}>
            <Text variant={desktop ? 'h1' : 'display'} color={colors.textOnDark}>
              {titulo}
            </Text>
            <Text
              variant="body"
              color={colors.textOnDarkMuted}
              style={{ marginTop: 2, textAlign: desktop ? 'left' : 'center' }}>
              {nome ? `Olá, ${nome.split(' ')[0]}.` : email}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: desktop ? spacing.xl : spacing.lg,
          paddingTop: desktop ? spacing.lg : spacing.xl,
          paddingBottom: spacing.xxl,
        }}>
        {/* Cartão informativo — o estado da conta, em texto. */}
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <Icon
              name={aprovado ? 'check-circle' : 'information-outline'}
              size="lg"
              color={aprovado ? colors.success : colors.info}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">
                {aprovado ? t('pendente.contaAtiva') : t('pendente.contaPendente')}
              </Text>
              <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                {aprovado
                  ? porCodigo
                    ? t('pendente.pecaCodigo')
                    : t('pendente.podeCriar')
                  : porCodigo
                    ? t('pendente.semEsperar')
                    : t('pendente.emAnalise')}
              </Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                {t('pendente.conta', { email })}
              </Text>
            </View>
          </View>
        </Card>

        {/* As opções que MUDAM alguma coisa. Esperar não é uma delas. */}
        <View
          style={{
            flexDirection: desktop ? 'row' : 'column',
            gap: spacing.sm,
            marginTop: spacing.lg,
          }}>
          {aprovado ? (
            <CartaoOpcao
              icone="barn"
              titulo={t('exploracoes.nova')}
              descricao={t('pendente.criarDescricao')}
              escolhida={escolha === 'criar'}
              onPress={() => setEscolha('criar')}
            />
          ) : null}
          <CartaoOpcao
            icone="ticket-confirmation-outline"
            titulo={t('pendente.tenhoCodigo')}
            descricao={t('pendente.tenhoCodigoDescricao')}
            escolhida={escolha === 'convite'}
            onPress={() => setEscolha('convite')}
          />
        </View>

        {escolha === 'criar' && aprovado ? (
          <View style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: desktop ? spacing.md : 0 }}>
              <Campo
                label={t('formAnimal.nome')}
                icon="barn"
                value={nomeExp}
                onChangeText={setNomeExp}
                placeholder={t('formExploracao.exNome')}
              />
              <Campo
                label={t('formExploracao.marca')}
                icon="barcode"
                value={marca}
                onChangeText={setMarca}
                placeholder={t('formExploracao.exMarca')}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: desktop ? spacing.md : 0 }}>
              <Campo
                label={t('formExploracao.nif')}
                icon="card-account-details-outline"
                value={nifDetentor}
                onChangeText={setNif}
                placeholder="000 000 000"
                keyboardType="number-pad"
              />
              <Campo label={t('formExploracao.localizacao')} opcional>
                {/* A localidade sai da mesma lista que dá a meteorologia — ver
                    `CampoLocalidade`. Escrita à mão continua a valer. */}
                <CampoLocalidade
                  value={localizacao}
                  onChangeText={setLocalizacao}
                  placeholder={t('formExploracao.exLocalizacao')}
                />
              </Campo>
            </View>
            {erroCriar ? <ErroBox mensagem={erroCriar} /> : null}
            <Button
              label={t('pendente.criarEContinuar')}
              icon="check"
              onPress={criarPrimeiraExploracao}
              disabled={!validoExp}
              loading={aGravar}
              fullWidth={!desktop}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : null}

        {escolha === 'convite' ? (
          <View style={{ marginTop: spacing.lg, maxWidth: desktop ? 420 : undefined }}>
            <Campo label={t('pendente.codigoConvite')} icon="ticket-confirmation-outline">
              <CampoTexto
                icon="ticket-confirmation-outline"
                value={codigo}
                onChangeText={(t) => setCodigo(t.toUpperCase())}
                placeholder={t('pendente.exCodigo')}
                autoCapitalize="characters"
              />
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                {t('pendente.pecaAoResponsavel')}
              </Text>
            </Campo>
            {erroResgate ? <ErroBox mensagem={erroResgate} /> : null}
            <Button
              label={t('pendente.entrarComCodigo')}
              icon="login"
              onPress={submeterCodigo}
              disabled={!codigo.trim()}
              loading={aResgatar}
              fullWidth={!desktop}
            />
          </View>
        ) : null}

        {/* Ações que existem sempre: voltar a perguntar ao servidor e sair. */}
        <View
          style={{
            flexDirection: desktop ? 'row' : 'column',
            gap: spacing.sm,
            marginTop: spacing.xl,
            paddingTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
          <Button
            label={t('pendente.verificarNovamente')}
            icon="refresh"
            variant={escolha === null ? 'primary' : 'secondary'}
            onPress={recarregar}
            loading={aCarregar}
            fullWidth={!desktop}
          />
          <Button
            label={t('perfil.terminarSessao')}
            icon="logout"
            variant="ghost"
            onPress={sair}
            fullWidth={!desktop}
          />
        </View>

        {/* Apagar a conta (5.1.1(v)).
            Fechado até alguém lhe tocar, e depois com a palavra escrita à mão,
            pela mesma razão do ecrã `conta/apagar`: um botão vermelho sozinho
            ao lado do "Terminar sessão" carrega-se sem ler, e este não tem
            volta. A distância é a funcionalidade. */}
        <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          {querApagar ? (
            <Card style={{ width: '100%', maxWidth: 420 }}>
              <Text variant="bodyStrong" color={colors.danger}>
                {t('perfil.apagarConta')}
              </Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: 2 }}>
                {t('pendente.apagarExplicacao')}
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <Campo
                  label={t('apagar.escrevaParaConfirmar', { palavra: PALAVRA_CONFIRMACAO })}
                  icon="alert-octagon-outline"
                  value={palavra}
                  onChangeText={setPalavra}
                  placeholder={PALAVRA_CONFIRMACAO}
                  autoCapitalize="characters"
                />
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: -spacing.xs }}>
                  {t('apagar.ajudaEscrever')}
                </Text>
              </View>
              {erroApagar ? (
                <Text variant="secondary" color={colors.danger} style={{ marginTop: spacing.sm }}>
                  {erroApagar}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  label={t('apagar.afinalNao')}
                  variant="secondary"
                  onPress={() => {
                    setQuerApagar(false);
                    setPalavra('');
                    setErroApagar(null);
                  }}
                />
                <Button
                  label={t('perfil.apagarConta')}
                  icon="delete-forever"
                  variant="danger"
                  onPress={perguntarPelaUltimaVez}
                  disabled={!podeApagar}
                  loading={aApagar}
                />
              </View>
            </Card>
          ) : (
            <Button
              label={t('perfil.apagarConta')}
              icon="delete-forever"
              variant="ghost"
              onPress={() => setQuerApagar(true)}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Traduz mensagens comuns vindas do Postgres para PT-PT. */
function traduzErroConvite(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('código inválido')) return t('pendente.codigoInvalido');
  if (m.includes('já foi usado') || m.includes('ja foi usado')) return t('pendente.codigoUsado');
  if (m.includes('expirado')) return t('pendente.codigoExpirado');
  // O código é de um papel e a conta foi criada para o outro (ver
  // `supabase/schema_convite_por_papel.sql`). A frase do servidor já diz qual é
  // qual e o que pedir a seguir — só lhe falta a maiúscula, porque as mensagens
  // do Postgres começam em minúscula por convenção.
  if (m.includes('a sua conta foi criada como')) return msg.charAt(0).toUpperCase() + msg.slice(1);
  return msg;
}

/**
 * Uma das duas maneiras de sair deste ecrã.
 *
 * Cartão inteiro tocável, com o que acontece escrito por baixo do título: quem
 * chega aqui não sabe necessariamente a diferença entre "criar exploração" e
 * "código de convite", e o rótulo sozinho não a explica.
 */
function CartaoOpcao({
  icone,
  titulo,
  descricao,
  escolhida,
  onPress,
}: {
  icone: IconName;
  titulo: string;
  descricao: string;
  escolhida: boolean;
  onPress: () => void;
}) {
  return (
    <Card
      onPress={onPress}
      // O cartão é um botão, e um botão não tem estado de escolhido para
      // anunciar — daí ir no rótulo. Sem isto, quem ouve o ecrã não sabe qual
      // dos dois formulários está aberto por baixo.
      accessibilityLabel={`${titulo}. ${descricao}${escolhida ? ' Escolhido.' : ''}`}
      style={{
        flex: 1,
        borderWidth: escolhida ? 2 : 1,
        borderColor: escolhida ? colors.primary : colors.border,
        backgroundColor: escolhida ? colors.primaryTint : colors.surface,
      }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: escolhida ? colors.primary : colors.primaryTint,
          }}>
          <Icon name={icone} size="md" color={escolhida ? colors.onPrimary : colors.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={escolhida ? colors.primaryDark : colors.text}>
            {titulo}
          </Text>
          <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: 2 }}>
            {descricao}
          </Text>
        </View>
        <Icon
          name={escolhida ? 'check-circle' : 'chevron-right'}
          size="md"
          color={escolhida ? colors.primary : colors.textMuted}
        />
      </View>
    </Card>
  );
}

function ErroBox({ mensagem }: { mensagem: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        alignItems: 'flex-start',
        backgroundColor: colors.dangerTint,
        padding: spacing.sm,
        borderRadius: radii.md,
        marginBottom: spacing.sm,
      }}>
      <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
      <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>{mensagem}</Text>
    </View>
  );
}

/** Rótulo + campo. Em janela larga, dois destes lado a lado dividem a linha. */
function Campo({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
  opcional,
  children,
}: {
  label: string;
  icon?: IconName;
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: 'default' | 'number-pad';
  opcional?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={{ flex: 1, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
        <Text variant="label">{label}</Text>
        {opcional ? <Text variant="caption" color={colors.textMuted}>opcional</Text> : null}
      </View>
      {children ?? (
        <CampoTexto
          icon={icon}
          value={value ?? ''}
          onChangeText={onChangeText ?? (() => {})}
          placeholder={placeholder ?? ''}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
        />
      )}
    </View>
  );
}

function CampoTexto({
  icon,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
}: {
  icon?: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
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
      {icon ? <Icon name={icon} size="md" color={colors.textMuted} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={false}
        style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
      />
    </View>
  );
}
