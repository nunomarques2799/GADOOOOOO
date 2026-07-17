import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { colors, layout, radii, spacing } from '@/theme';

/** Só rotas em texto (as tipadas do expo-router), para as podermos comparar
 *  com o pathname atual e saber qual o item ativo. */
type Rota = Extract<Href, string>;

export type ItemNav = { rota: Rota; label: string; icon: IconName };

/**
 * Navegação lateral do desenho de desktop — substitui a barra de separadores
 * inferior (que existe para o polegar, num ecrã que aqui não há). Fica sempre
 * visível, com etiquetas legíveis, para não obrigar a decorar ícones.
 */
export function BarraLateral({ itens }: { itens: ItemNav[] }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <LinearGradient
      colors={[colors.headerFrom, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        width: layout.barraLateral,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.sm,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.xl,
        }}>
        <Icon name="cow" size="xl" color={colors.textOnDark} />
        <Text variant="h3" color={colors.textOnDark}>
          Gestão de Gado
        </Text>
      </View>

      <View style={{ gap: spacing.xxs }}>
        {itens.map((item) => (
          <ItemBarra key={item.rota} item={item} ativo={estaAtivo(pathname, item.rota)} onPress={() => router.navigate(item.rota)} />
        ))}
      </View>
    </LinearGradient>
  );
}

/** A raiz só é ativa em correspondência exata; as outras cobrem sub-rotas. */
function estaAtivo(pathname: string, rota: Rota) {
  if (rota === '/') return pathname === '/';
  return pathname === rota || pathname.startsWith(`${rota}/`);
}

function ItemBarra({
  item,
  ativo,
  onPress,
}: {
  item: ItemNav;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={item.label}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          height: 52,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.md,
          backgroundColor: ativo
            ? 'rgba(255,255,255,0.16)'
            : hovered
              ? 'rgba(255,255,255,0.08)'
              : 'transparent',
        },
        pressed && { opacity: 0.8 },
      ]}>
      <Icon
        name={item.icon}
        size="lg"
        color={ativo ? colors.textOnDark : colors.textOnDarkMuted}
      />
      <Text
        variant={ativo ? 'bodyStrong' : 'body'}
        color={ativo ? colors.textOnDark : colors.textOnDarkMuted}>
        {item.label}
      </Text>
    </Pressable>
  );
}
