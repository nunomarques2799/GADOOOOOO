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
        <Text variant="h1" style={{ marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {/* Três cartões lado a lado deixam pouca largura: "Explorações" não
            cabe numa linha e o Android partia-a a meio da palavra ("Explor
            ações"). Encolher a letra até caber é mais legível do que partir. */}
        <Text
          variant="secondary"
          color={colors.textSecondary}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}>
          {label}
        </Text>
      </View>
    </Card>
  );
}
