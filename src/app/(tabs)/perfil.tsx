import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Card, Icon, type IconName, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors, radii, spacing } from '@/theme';

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { utilizador, animais, exploracoes } = useGado();
  const iniciais = utilizador.nome.split(' ').map((p) => p[0]).slice(0, 2).join('');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
        }}>
        <Text variant="display">Perfil</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {/* Cartão do utilizador */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar initials={iniciais} size={64} />
            <View style={{ flex: 1 }}>
              <Text variant="h2" numberOfLines={1}>
                {utilizador.nome}
              </Text>
              <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                {utilizador.email}
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

        {/* Definições */}
        <Card padded={false}>
          <SettingRow icon="account-edit" label="Editar dados pessoais" />
          <SettingRow icon="cloud-sync-outline" label="Sincronização e cópia de segurança" />
          <SettingRow icon="file-export-outline" label="Exportar para o iDigital" trailing="Fase 2" />
          <SettingRow icon="bell-outline" label="Notificações e alertas" />
          <SettingRow icon="help-circle-outline" label="Ajuda e apoio" last />
        </Card>

        {/* Terminar sessão — separado das definições */}
        <Card padded={false}>
          <SettingRow icon="logout" label="Terminar sessão" tint={colors.danger} last />
        </Card>

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
  last,
}: {
  icon: IconName;
  label: string;
  trailing?: string;
  tint?: string;
  last?: boolean;
}) {
  return (
    <Pressable
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
