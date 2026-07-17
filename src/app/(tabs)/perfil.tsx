import { Alert, Linking, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import {
  csvAnimais,
  csvEventos,
  guardarFicheiro,
  hojeISO,
  htmlRelatorioPrazos,
  imprimirRelatorio,
} from '@/data/exportar';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { utilizador, animais, eventos, exploracoes, terrenos, alertas } = useGado();
  const { utilizador: conta, sair, configurado, apagarConta } = useAuth();

  async function exportarAnimais() {
    await guardarFicheiro(`animais-${hojeISO()}.csv`, csvAnimais(animais, exploracoes, terrenos));
  }
  async function exportarEventos() {
    await guardarFicheiro(`eventos-${hojeISO()}.csv`, csvEventos(eventos, animais));
  }
  function exportarPrazos() {
    const ok = imprimirRelatorio('Relatório de prazos — Gestão de Gado', htmlRelatorioPrazos(alertas));
    if (!ok) {
      Alert.alert('Indisponível', 'O relatório em PDF está disponível na versão de computador.');
    }
  }

  function confirmarApagarConta() {
    const msg =
      'Vai apagar a sua conta e TODOS os dados (explorações, animais, terrenos e histórico). ' +
      'Esta ação é permanente e não pode ser desfeita. Tem a certeza?';
    const executar = async () => {
      const erro = await apagarConta();
      if (erro) {
        const texto = `Não foi possível apagar a conta: ${erro}`;
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') window.alert(texto);
        } else {
          Alert.alert('Erro', texto);
        }
      }
      // Em caso de sucesso, a sessão é limpa e o portão de auth volta ao login.
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) void executar();
      return;
    }
    Alert.alert('Apagar a minha conta', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar tudo', style: 'destructive', onPress: () => void executar() },
    ]);
  }

  // Com sessão iniciada, mostra os dados da conta; senão, o utilizador local.
  const nome = (conta?.user_metadata?.nome as string | undefined)?.trim() || utilizador.nome;
  const email = conta?.email ?? utilizador.email;
  const iniciais = (nome || email).split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  // Uma lista de opções não ganha em esticar por um ecrã largo — em desktop
  // fica numa coluna única centrada.
  const colunaPerfil = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          ...colunaPerfil,
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.lg,
        }}>
        <Text variant="display">Perfil</Text>
      </View>

      <View style={{ ...colunaPerfil, gap: spacing.md }}>
        {/* Cartão do utilizador */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar initials={iniciais} size={64} />
            <View style={{ flex: 1 }}>
              <Text variant="h2" numberOfLines={1}>
                {nome}
              </Text>
              <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                {email}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                <Badge tone="brand" icon="cow" label={`${animais.length} animais`} />
                <Badge tone="neutral" icon="barn" label={`${exploracoes.length} explor.`} />
              </View>
            </View>
          </View>
        </Card>

        {/* Estado de sincronização (offline-first) */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.pill,
                backgroundColor: colors.successTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="cloud-check-outline" size="md" color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Dados guardados no dispositivo</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                Funciona sem internet. Sincroniza quando houver rede.
              </Text>
            </View>
          </View>
        </Card>

        {/* Exportar e relatórios */}
        <View>
          <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
            EXPORTAR E RELATÓRIOS
          </Text>
          <Card padded={false}>
            <SettingRow
              icon="cow"
              label="Exportar animais (CSV)"
              trailing={String(animais.length)}
              onPress={exportarAnimais}
            />
            <SettingRow
              icon="calendar-text-outline"
              label="Exportar eventos (CSV)"
              trailing={String(eventos.length)}
              onPress={exportarEventos}
            />
            <SettingRow
              icon="file-chart-outline"
              label="Relatório de prazos (PDF)"
              trailing={String(alertas.length)}
              onPress={exportarPrazos}
              last
            />
          </Card>
        </View>

        {/* Definições */}
        <Card padded={false}>
          <SettingRow icon="account-edit" label="Editar dados pessoais" />
          <SettingRow icon="cloud-sync-outline" label="Sincronização e cópia de segurança" />
          <SettingRow icon="file-export-outline" label="Exportar para o iDigital" trailing="Fase 2" />
          <SettingRow icon="bell-outline" label="Notificações e alertas" />
          <SettingRow
            icon="shield-account-outline"
            label="Privacidade e termos"
            onPress={() => void Linking.openURL('https://gestaogado.netlify.app/privacidade')}
          />
          <SettingRow icon="help-circle-outline" label="Ajuda e apoio" last />
        </Card>

        {/* Conta — sessão e apagamento RGPD (só com Supabase/sessão) */}
        {configurado ? (
          <Card padded={false}>
            <SettingRow icon="logout" label="Terminar sessão" tint={colors.danger} onPress={sair} />
            <SettingRow
              icon="delete-outline"
              label="Apagar a minha conta"
              tint={colors.danger}
              onPress={confirmarApagarConta}
              last
            />
          </Card>
        ) : null}

        <Text variant="caption" color={colors.textMuted} center style={{ marginTop: spacing.xs }}>
          Gestão de Gado · versão 0.1.0
        </Text>
      </View>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  trailing,
  tint = colors.text,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  trailing?: string;
  tint?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icon} size="md" color={tint === colors.text ? colors.primary : tint} />
      <Text variant="body" color={tint} style={{ flex: 1 }}>
        {label}
      </Text>
      {trailing ? (
        <Text variant="caption" color={colors.textMuted}>
          {trailing}
        </Text>
      ) : null}
      <Icon name="chevron-right" size="sm" color={colors.textMuted} />
    </Pressable>
  );
}
