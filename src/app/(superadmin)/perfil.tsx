import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Card, Icon, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

export default function SuperadminPerfilScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { utilizador, sair } = useAuth();

  const nome = (utilizador?.user_metadata?.nome as string | undefined)?.trim() || 'Superadmin';
  const email = utilizador?.email ?? '';
  const iniciais = (nome || email).split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  // Ver nota em (tabs)/perfil.tsx: coluna única centrada em desktop.
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
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar initials={iniciais} size={64} />
            <View style={{ flex: 1 }}>
              <Text variant="h2" numberOfLines={1}>{nome}</Text>
              <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>{email}</Text>
              <View style={{ marginTop: spacing.xs }}>
                <Badge tone="brand" icon="shield-crown" label="Administrador da plataforma" />
              </View>
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.pill,
                backgroundColor: colors.infoTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="information-outline" size="md" color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Conta de superadmin</Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                Esta conta gere a plataforma. Para ver ou registar animais/explorações
                use uma conta de cliente normal.
              </Text>
            </View>
          </View>
        </Card>

        <Card padded={false}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
            }}>
            <Icon name="logout" size="md" color={colors.danger} />
            <Text
              variant="body"
              color={colors.danger}
              style={{ flex: 1 }}
              onPress={sair}
              accessibilityRole="button">
              Terminar sessão
            </Text>
          </View>
        </Card>

        <Text variant="caption" color={colors.textMuted} center style={{ marginTop: spacing.xs }}>
          Gestão de Gado · superadmin · v0.1.0
        </Text>
      </View>
    </View>
  );
}
