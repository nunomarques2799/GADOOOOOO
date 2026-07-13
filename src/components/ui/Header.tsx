import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  /** Ícone da ação à direita (opcional). */
  actionIcon?: IconName;
  onAction?: () => void;
  /** Cor de fundo — por omissão transparente sobre o fundo do ecrã. */
  background?: string;
};

/**
 * Cabeçalho de ecrã de detalhe/formulário: botão de voltar circular,
 * título centrado e ação opcional. Respeita a safe-area superior.
 */
export function Header({ title, actionIcon, onAction, background = 'transparent' }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + spacing.xs,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: background,
      }}>
      <CircleButton icon="chevron-left" onPress={() => router.back()} label="Voltar" />
      <Text variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      {actionIcon && onAction ? (
        <CircleButton icon={actionIcon} onPress={onAction} label="Ação" />
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );
}

function CircleButton({
  icon,
  onPress,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="md" color={colors.text} />
    </Pressable>
  );
}
