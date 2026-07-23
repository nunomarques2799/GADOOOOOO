import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { traduzErroServidor } from '@/data/errosServidor';
import { useMembros } from '@/data/membros';
import { supabase } from '@/data/supabase';
import { colors, radii, sizes, spacing } from '@/theme';

type Aba = 'aguardar' | 'criar' | 'convite';

function novoId(prefixo: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `${prefixo}-${uuid}`;
}

/**
 * Ecrã mostrado a utilizadores autenticados que ainda não têm acesso.
 * O que mostra depende do estado:
 *   - estado='pendente'                      → "aguarda aprovação do superadmin"
 *     mas pode entrar um código de convite (trabalhador/vet).
 *   - estado='ativo' + 0 membros             → pode criar a sua primeira exploração
 *     ou resgatar um código.
 */
export function EcraPendente() {
  const insets = useSafeAreaInsets();
  const { utilizador, sair } = useAuth();
  const { recarregar, aCarregar, estadoPerfil, resgatarConvite } = useMembros();

  const nome = utilizador?.user_metadata?.nome as string | undefined;
  const email = utilizador?.email ?? '';
  const aprovado = estadoPerfil === 'ativo';

  const [aba, setAba] = useState<Aba>('aguardar');

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
      setErroCriar(traduzErroServidor(error.message));
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
          <Icon name={aprovado ? 'barn' : 'clock-outline'} size={48} color={colors.textOnDark} />
        </View>
        <Text variant="display" color={colors.textOnDark}>
          {aprovado ? 'Bem-vindo' : 'A aguardar aprovação'}
        </Text>
        <Text variant="body" color={colors.textOnDarkMuted} style={{ marginTop: 2, textAlign: 'center' }}>
          {nome ? `Olá, ${nome.split(' ')[0]}.` : ''}
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl }}>
        {/* Cartão informativo */}
        {aprovado ? (
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="check-circle" size="lg" color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">A sua conta está ativa</Text>
                <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                  Pode criar a sua primeira exploração ou associar-se a uma através de
                  um código de convite.
                </Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                  Conta: {email}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="information-outline" size="lg" color={colors.info} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">A sua conta está pendente</Text>
                <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                  O administrador da plataforma vai analisar o pedido de acesso.
                  Se recebeu um <Text variant="bodyStrong">código de convite</Text> de
                  um cliente para trabalhar/prestar serviço veterinário, use-o abaixo
                  para entrar de imediato.
                </Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                  Conta: {email}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Abas */}
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg }}>
          <AbaBtn
            label="Aguardar"
            icon="clock-outline"
            ativa={aba === 'aguardar'}
            onPress={() => setAba('aguardar')}
          />
          {aprovado ? (
            <AbaBtn
              label="Criar exploração"
              icon="barn"
              ativa={aba === 'criar'}
              onPress={() => setAba('criar')}
            />
          ) : null}
          <AbaBtn
            label="Tenho um código"
            icon="ticket-confirmation-outline"
            ativa={aba === 'convite'}
            onPress={() => setAba('convite')}
          />
        </View>

        {aba === 'aguardar' ? (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              label="Verificar novamente"
              icon="refresh"
              onPress={recarregar}
              loading={aCarregar}
            />
            <Button
              label="Terminar sessão"
              icon="logout"
              variant="ghost"
              onPress={sair}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : null}

        {aba === 'criar' && aprovado ? (
          <View style={{ marginTop: spacing.lg }}>
            <Campo label="Nome" icon="barn" value={nomeExp} onChangeText={setNomeExp} placeholder="Ex: Monte do Avô" />
            <Campo label="Marca de exploração" icon="barcode" value={marca} onChangeText={setMarca} placeholder="PT 00 000 0000" autoCapitalize="characters" />
            <Campo label="NIF do detentor" icon="card-account-details-outline" value={nifDetentor} onChangeText={setNif} placeholder="000 000 000" keyboardType="number-pad" />
            <Campo label="Localização" icon="map-marker" value={localizacao} onChangeText={setLocalizacao} placeholder="Ex: Idanha-a-Nova" opcional />
            {erroCriar ? <ErroBox mensagem={erroCriar} /> : null}
            <Button
              label="Criar e continuar"
              icon="check"
              onPress={criarPrimeiraExploracao}
              disabled={!validoExp}
              loading={aGravar}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : null}

        {aba === 'convite' ? (
          <View style={{ marginTop: spacing.lg }}>
            <Campo
              label="Código de convite"
              icon="ticket-confirmation-outline"
              value={codigo}
              onChangeText={(t) => setCodigo(t.toUpperCase())}
              placeholder="Ex: A7BXK2M9"
              autoCapitalize="characters"
            />
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: -spacing.md + 4, marginBottom: spacing.md }}>
              Peça o código ao cliente responsável pela exploração.
            </Text>
            {erroResgate ? <ErroBox mensagem={erroResgate} /> : null}
            <Button
              label="Entrar com este código"
              icon="login"
              onPress={submeterCodigo}
              disabled={!codigo.trim()}
              loading={aResgatar}
            />
          </View>
        ) : null}
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

function AbaBtn({
  label,
  icon,
  ativa,
  onPress,
}: {
  label: string;
  icon: IconName;
  ativa: boolean;
  onPress: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Button
        label={label}
        icon={icon}
        variant={ativa ? 'primary' : 'ghost'}
        onPress={onPress}
      />
    </View>
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
        marginTop: spacing.sm,
      }}>
      <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
      <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>{mensagem}</Text>
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
  opcional,
}: {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: 'default' | 'number-pad';
  opcional?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
        <Text variant="label">{label}</Text>
        {opcional ? <Text variant="caption" color={colors.textMuted}>opcional</Text> : null}
      </View>
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
          autoCorrect={false}
          style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
        />
      </View>
    </View>
  );
}
