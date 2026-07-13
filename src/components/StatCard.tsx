import { View } from 'react-native';

import { Card, Icon, type IconName, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

type Props = {
  icon: IconName;
  value: string | number;
  label: string;
  tint?: string;
  onPress?: () => void;
};

/** Cartão de estatística compacto (nº animais, terrenos…). */
export function StatCard({ icon, value, label, tint = colors.primary, onPress }: Props) {
  return (
    <Card onPress={onPress} style={{ flex: 1 }} padded={false}>
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <Icon name={icon} size="md" color={tint} />
        <Text variant="h1" style={{ marginTop: 2 }}>
          {value}
        </Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {label}
        </Text>
      </View>
    </Card>
  );
}
