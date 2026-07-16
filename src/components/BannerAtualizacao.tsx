import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { URL_DESCARREGAR, useAtualizacaoDesktop } from '@/data/useAtualizacao';
import { colors, radii, spacing } from '@/theme';

/**
 * Banner mostrado na app desktop quando há uma versão mais recente publicada.
 * Não instala nada — leva o utilizador à página de download do site.
 */
export function BannerAtualizacao() {
  const disponivel = useAtualizacaoDesktop();
  const [fechado, setFechado] = useState(false);
  if (!disponivel || fechado) return null;

  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.info }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="download-circle-outline" size="lg" color={colors.info} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Nova versão disponível</Text>
          <Text variant="secondary" color={colors.textSecondary}>
            Há uma atualização da app para Windows.
          </Text>
        </View>
        <Pressable
          onPress={() => setFechado(true)}
          accessibilityRole="button"
          accessibilityLabel="Dispensar"
          hitSlop={8}>
          <Icon name="close" size="md" color={colors.textMuted} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => void Linking.openURL(URL_DESCARREGAR)}
        accessibilityRole="button"
        accessibilityLabel="Descarregar nova versão"
        style={({ pressed }) => [
          {
            marginTop: spacing.sm,
            height: 46,
            borderRadius: radii.md,
            backgroundColor: colors.info,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: spacing.xs,
          },
          pressed && { opacity: 0.85 },
        ]}>
        <Icon name="download" size="sm" color={colors.onPrimary} />
        <Text variant="button" color={colors.onPrimary} style={{ fontSize: 16 }}>
          Descarregar
        </Text>
      </Pressable>
    </Card>
  );
}
