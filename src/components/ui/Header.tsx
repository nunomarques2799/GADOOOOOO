import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  /** Ícone da ação à direita (opcional). */
  actionIcon?: IconName;
  onAction?: () => void;
  /**
   * Com rótulo, a ação deixa de ser um círculo só com o ícone e passa a uma
   * pastilha com ícone e palavra ("✎ Editar"), como na ficha do guia. Um lápis
   * sozinho num círculo é um enigma para quem não usa telemóveis há anos.
   */
  actionLabel?: string;
  /** Cor de fundo — por omissão transparente sobre o fundo do ecrã. */
  background?: string;
};

/**
 * Cabeçalho de ecrã de detalhe/formulário: botão de voltar circular,
 * título centrado e ação opcional. Respeita a safe-area superior.
 */
export function Header({ title, actionIcon, onAction, actionLabel, background = 'transparent' }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const acao =
    actionIcon && onAction ? (
      actionLabel ? (
        <Pastilha icon={actionIcon} label={actionLabel} onPress={onAction} />
      ) : (
        <CircleButton icon={actionIcon} onPress={onAction} label={t('comum.acao')} />
      )
    ) : null;

  return (
    <View
      style={{
        paddingTop: insets.top + spacing.xs,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.xs,
        backgroundColor: background,
      }}>
      <CircleButton icon="chevron-left" onPress={() => router.back()} label={t('comum.voltar')} />
      <Text variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      {/* Do mesmo tamanho dos dois lados quando não há rótulo, para o título
          ficar mesmo ao centro. */}
      {acao ?? <View style={{ width: 46 }} />}
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
          width: 46,
          height: 46,
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

function Pastilha({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        {
          height: 46,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.md,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="sm" color={colors.text} />
      <Text variant="label" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
