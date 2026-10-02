import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Com ícone, a ação lê-se "+ Marcar" (o ícone à frente) em vez de
   * "Ver todos ›": é um verbo, não um caminho para outro ecrã.
   */
  actionIcon?: IconName;
  /** Outra coisa à direita do título (a etiqueta "2 urgentes" do Início). */
  direita?: ReactNode;
};

/** Cabeçalho de secção (Fraunces) com ação opcional à direita. */
export function SectionHeader({ title, actionLabel, onAction, actionIcon, direita }: Props) {
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
      <Text variant="h2" style={{ flexShrink: 1 }} numberOfLines={3}>
        {title}
      </Text>
      {direita}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
            pressed && { opacity: 0.6 },
          ]}>
          {actionIcon ? <Icon name={actionIcon} size="sm" color={colors.primary} /> : null}
          <Text variant="label" color={colors.primary}>
            {actionLabel}
          </Text>
          {actionIcon ? null : <Icon name="chevron-right" size="sm" color={colors.primary} />}
        </Pressable>
      ) : null}
    </View>
  );
}
