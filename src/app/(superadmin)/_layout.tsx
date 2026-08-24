import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraLateral, type ItemNav } from '@/components/BarraLateral';
import { Icon, type IconName, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { recarregarPorTratar, useDenunciasPorTratar } from '@/data/useDenuncias';
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
  denuncias: { label: 'Denúncias', icon: 'flag-variant' },
  perfil: { label: 'Perfil', icon: 'shield-crown' },
};

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const porTratar = useDenunciasPorTratar();
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
        const porLer = route.name === 'denuncias' ? porTratar : 0;
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
            accessibilityLabel={
              porLer > 0 ? `${cfg.label}, ${porLer} por tratar` : cfg.label
            }
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
              {/* O ponto das denúncias por tratar, igual ao das mensagens por
                  ler da app: sem número lá dentro, porque num ícone de 26px um
                  "12" fica ilegível e o que interessa é saber que há trabalho.
                  A conta certa está na aba. */}
              {porLer > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 12,
                    minWidth: 12,
                    height: 12,
                    borderRadius: radii.pill,
                    backgroundColor: colors.danger,
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                />
              ) : null}
            </View>
            <Text
              variant="caption"
              color={focused ? colors.primaryDark : colors.textMuted}
              numberOfLines={1}>
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
  { rota: '/denuncias', label: 'Denúncias', icon: TABS.denuncias.icon },
  { rota: '/perfil', label: 'Perfil', icon: TABS.perfil.icon },
];

export default function SuperadminTabsLayout() {
  const desktop = useDesktop();
  const { isSuperadmin, aCarregar } = useMembros();

  // Perguntar assim que o painel abre, e não quando alguém entrar na aba: o
  // ponto vermelho existe justamente para dizer que há trabalho a quem não
  // pensou em ir lá ver. É a razão de a `denuncias_por_tratar()` existir.
  useEffect(() => {
    if (isSuperadmin) void recarregarPorTratar();
  }, [isSuperadmin]);

  if (aCarregar) return null;
  if (!isSuperadmin) return <Redirect href="/" />;

  const ecrans = (
    <Tabs
      tabBar={desktop ? () => null : (props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="clientes" />
      <Tabs.Screen name="denuncias" />
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
