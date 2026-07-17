import { Redirect, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraLateral, type ItemNav } from '@/components/BarraLateral';
import { Icon, type IconName, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, radii, shadow, spacing } from '@/theme';

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

const TABS: Record<string, { label: string; icon: IconName }> = {
  clientes: { label: 'Clientes', icon: 'account-group' },
  perfil: { label: 'Perfil', icon: 'shield-crown' },
};

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: colors.surface,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm,
          paddingHorizontal: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
        },
        shadow.lg,
      ]}>
      {state.routes.map((route, index) => {
        const cfg = TABS[route.name];
        if (!cfg) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={cfg.label}
            style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 }}>
            <View
              style={{
                width: 56,
                height: 34,
                borderRadius: radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.primaryTint : 'transparent',
              }}>
              <Icon name={cfg.icon} size={26} color={focused ? colors.primary : colors.textMuted} />
            </View>
            <Text variant="caption" color={focused ? colors.primaryDark : colors.textMuted}>
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const NAV_DESKTOP: ItemNav[] = [
  { rota: '/clientes', label: 'Clientes', icon: TABS.clientes.icon },
  { rota: '/perfil', label: 'Perfil', icon: TABS.perfil.icon },
];

export default function SuperadminTabsLayout() {
  const desktop = useDesktop();
  const { isSuperadmin, aCarregar } = useMembros();
  if (aCarregar) return null;
  if (!isSuperadmin) return <Redirect href="/" />;

  const ecrans = (
    <Tabs
      tabBar={desktop ? () => null : (props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="clientes" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );

  if (!desktop) return ecrans;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <BarraLateral itens={NAV_DESKTOP} />
      <View style={{ flex: 1 }}>{ecrans}</View>
    </View>
  );
}
