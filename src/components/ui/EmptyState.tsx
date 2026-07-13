import { View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Estado vazio útil: ícone + explicação + ação (regra empty-states). */
export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.huge, paddingHorizontal: spacing.lg }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: radii.pill,
          backgroundColor: colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}>
        <Icon name={icon} size={44} color={colors.primary} />
      </View>
      <Text variant="h2" center style={{ marginBottom: spacing.xs }}>
        {title}
      </Text>
      <Text variant="body" color={colors.textSecondary} center style={{ marginBottom: spacing.xl }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} icon="plus" onPress={onAction} fullWidth={false} />
      ) : null}
    </View>
  );
}
