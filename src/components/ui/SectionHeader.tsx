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
        gap: spacing.sm,
        marginBottom: spacing.sm,
        marginTop: spacing.xl,
      }}>
      {/* O título cede espaço à ação em vez de a empurrar para fora do ecrã —
          com a letra do sistema ampliada, os dois sobrepunham-se. */}
      <Text variant="h2" style={{ flexShrink: 1 }} numberOfLines={2}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
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
