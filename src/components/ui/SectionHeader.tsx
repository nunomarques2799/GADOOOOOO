import { Pressable, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Cabeçalho de secção com ação opcional "Ver tudo". */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
        marginTop: spacing.xl,
      }}>
      <Text variant="h2">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 2 },
            pressed && { opacity: 0.6 },
          ]}>
          <Text variant="label" color={colors.primary}>
            {actionLabel}
          </Text>
          <Icon name="chevron-right" size="sm" color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}
