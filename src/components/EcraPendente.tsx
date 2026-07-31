import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CampoLocalidade } from '@/components/CampoLocalidade';
import { Button, Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { entraPorCodigo, lerIntencao } from '@/data/intencao';
import { useMembros } from '@/data/membros';
import { explicarRecusa } from '@/data/supabaseRepo';
import { supabase } from '@/data/supabase';
import { useDesktop } from '@/hooks/useDesktop';
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
  const { utilizador, sair } = useAuth();
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

  const titulo = aprovado ? 'Bem-vindo' : porCodigo ? 'Falta o código' : 'A aguardar aprovação';

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
                {aprovado ? 'A sua conta está ativa' : 'A sua conta está pendente'}
              </Text>
              <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                {aprovado
                  ? porCodigo
                    ? 'Peça o código de convite a quem gere a exploração onde vai trabalhar e escreva-o abaixo.'
                    : 'Pode criar a sua primeira exploração ou associar-se a uma através de um código de convite.'
                  : porCodigo
                    ? 'Não tem de esperar por ninguém: com o código de convite de uma exploração entra de imediato. Peça-o a quem a gere.'
                    : 'O administrador da plataforma vai analisar o pedido de acesso. Se tiver recebido um código de convite de um cliente, pode usá-lo já para entrar.'}
              </Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                Conta: {email}
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
              titulo="Criar exploração"
              descricao="Registar a minha exploração e começar a lançar animais."
              escolhida={escolha === 'criar'}
              onPress={() => setEscolha('criar')}
            />
          ) : null}
          <CartaoOpcao
            icone="ticket-confirmation-outline"
            titulo="Tenho um código"
            descricao="Entrar na exploração de outra pessoa com um código de convite."
            escolhida={escolha === 'convite'}
            onPress={() => setEscolha('convite')}
          />
        </View>

        {escolha === 'criar' && aprovado ? (
          <View style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: desktop ? spacing.md : 0 }}>
              <Campo
                label="Nome"
                icon="barn"
                value={nomeExp}
                onChangeText={setNomeExp}
                placeholder="Ex: Monte do Avô"
              />
              <Campo
                label="Marca de exploração"
                icon="barcode"
                value={marca}
                onChangeText={setMarca}
                placeholder="PT 00 000 0000"
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: desktop ? spacing.md : 0 }}>
              <Campo
                label="NIF do detentor"
                icon="card-account-details-outline"
                value={nifDetentor}
                onChangeText={setNif}
                placeholder="000 000 000"
                keyboardType="number-pad"
              />
              <Campo label="Localização" opcional>
                {/* A localidade sai da mesma lista que dá a meteorologia — ver
                    `CampoLocalidade`. Escrita à mão continua a valer. */}
                <CampoLocalidade
                  value={localizacao}
                  onChangeText={setLocalizacao}
                  placeholder="Ex: Idanha-a-Nova"
                />
              </Campo>
            </View>
            {erroCriar ? <ErroBox mensagem={erroCriar} /> : null}
            <Button
              label="Criar e continuar"
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
            <Campo label="Código de convite" icon="ticket-confirmation-outline">
              <CampoTexto
                icon="ticket-confirmation-outline"
                value={codigo}
                onChangeText={(t) => setCodigo(t.toUpperCase())}
                placeholder="Ex: A7BXK2M9"
                autoCapitalize="characters"
              />
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                Peça o código ao responsável pela exploração.
              </Text>
            </Campo>
            {erroResgate ? <ErroBox mensagem={erroResgate} /> : null}
            <Button
              label="Entrar com este código"
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
            label="Verificar novamente"
            icon="refresh"
            variant={escolha === null ? 'primary' : 'secondary'}
            onPress={recarregar}
            loading={aCarregar}
            fullWidth={!desktop}
          />
          <Button
            label="Terminar sessão"
            icon="logout"
            variant="ghost"
            onPress={sair}
            fullWidth={!desktop}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/** Traduz mensagens comuns vindas do Postgres para PT-PT. */
function traduzErroConvite(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('código inválido')) return 'Código inválido.';
  if (m.includes('já foi usado') || m.includes('ja foi usado')) return 'Este código já foi utilizado.';
  if (m.includes('expirado')) return 'Este código expirou. Peça um novo ao cliente.';
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
