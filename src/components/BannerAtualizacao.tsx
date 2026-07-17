import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { useAtualizacaoDesktop } from '@/data/useAtualizacao';
import { colors, radii, spacing } from '@/theme';

/**
 * Banner na app desktop quando já há uma versão nova descarregada. Um clique
 * instala e reabre a app — não há nada para descarregar à mão.
 */
export function BannerAtualizacao() {
  const { pronta, instalar } = useAtualizacaoDesktop();
  const [fechado, setFechado] = useState(false);
  const [aInstalar, setAInstalar] = useState(false);
  if (!pronta || fechado) return null;

  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.info }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="download-circle-outline" size="lg" color={colors.info} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Nova versão pronta</Text>
          <Text variant="secondary" color={colors.textSecondary}>
            Já está descarregada. A app fecha e volta a abrir sozinha.
          </Text>
        </View>
        {aInstalar ? null : (
          <Pressable
            onPress={() => setFechado(true)}
            accessibilityRole="button"
            accessibilityLabel="Dispensar"
            hitSlop={8}>
            <Icon name="close" size="md" color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={() => {
          setAInstalar(true);
          instalar();
        }}
        disabled={aInstalar}
        accessibilityRole="button"
        accessibilityLabel="Atualizar agora"
        accessibilityState={{ disabled: aInstalar }}
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
          (pressed || aInstalar) && { opacity: 0.85 },
        ]}>
        <Icon name={aInstalar ? 'progress-download' : 'download'} size="sm" color={colors.onPrimary} />
        <Text variant="button" color={colors.onPrimary} style={{ fontSize: 16 }}>
          {aInstalar ? 'A atualizar…' : 'Atualizar agora'}
        </Text>
      </Pressable>
    </Card>
  );
}
