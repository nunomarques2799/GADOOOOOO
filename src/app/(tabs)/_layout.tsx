import { Tabs, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraLateral, type ItemNav } from '@/components/BarraLateral';
import { Icon, type IconName, Text } from '@/components/ui';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, radii, shadow, spacing } from '@/theme';

/** Forma mínima das props do tabBar que usamos (evita dependência direta). */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

type Rota = Extract<Href, string>;
type Destino = { nome: string; rota: Rota; label: string; icon: IconName };

/**
 * Os nove destinos, pela ordem em que aparecem na barra lateral.
 * `nome` é o ficheiro dentro de `(tabs)/`; `rota` é o URL (o grupo `(tabs)`
 * não aparece no caminho, por isso `(tabs)/alertas.tsx` serve `/alertas`).
 */
const DESTINOS: Destino[] = [
  { nome: 'index', rota: '/', label: 'Início', icon: 'home-variant' },
  { nome: 'exploracoes', rota: '/exploracoes', label: 'Explorações', icon: 'barn' },
  { nome: 'terrenos', rota: '/terrenos', label: 'Terrenos', icon: 'grass' },
  { nome: 'animais', rota: '/animais', label: 'Animais', icon: 'cow' },
  { nome: 'alertas', rota: '/alertas', label: 'Alertas', icon: 'bell-outline' },
  { nome: 'financas', rota: '/financas', label: 'Finanças', icon: 'cash-multiple' },
  { nome: 'documentos', rota: '/documentos', label: 'Documentos', icon: 'file-document-outline' },
  { nome: 'definicoes', rota: '/definicoes', label: 'Definições', icon: 'cog-outline' },
  { nome: 'perfil', rota: '/perfil', label: 'Perfil', icon: 'account' },
];

/**
 * O que fica na barra de baixo do TELEMÓVEL. São cinco lugares e nove
 * destinos: a barra reparte a largura por todos, e com nove cada um ficaria
 * espremido num ecrã de 375px — bem menos ainda com a letra do sistema no
 * máximo, que é o cenário que esta app tem de aguentar. Ficam os quatro do
 * dia-a-dia e um botão "Mais" para os outros cinco.
 *
 * No computador não há este problema: a lateral é vertical e leva os oito.
 */
const NO_TELEMOVEL = ['index', 'animais', 'exploracoes', 'alertas'];

const NAV_DESKTOP: ItemNav[] = DESTINOS.map((d) => ({
  rota: d.rota,
  label: d.label,
  icon: d.icon,
}));

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [maisAberto, setMaisAberto] = useState(false);

  const visiveis = state.routes.filter((r) => NO_TELEMOVEL.includes(r.name));
  const escondidos = DESTINOS.filter((d) => !NO_TELEMOVEL.includes(d.nome));
  const rotaAtual = state.routes[state.index]?.name;
  // O "Mais" acende-se quando se está num dos destinos que ele guarda — senão
  // a barra não mostrava nada selecionado e a app parecia ter-se perdido.
  const maisAtivo = escondidos.some((d) => d.nome === rotaAtual);

  return (
    <>
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
        {visiveis.map((route) => {
          const cfg = DESTINOS.find((d) => d.nome === route.name);
          if (!cfg) return null;
          const focused = rotaAtual === route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Botao
              key={route.key}
              label={cfg.label}
              icon={cfg.icon}
              focused={focused}
              onPress={onPress}
            />
          );
        })}
        <Botao
          label="Mais"
          icon="dots-horizontal"
          focused={maisAtivo}
          onPress={() => setMaisAberto(true)}
        />
      </View>

      <Modal
        visible={maisAberto}
        animationType="slide"
        transparent
        onRequestClose={() => setMaisAberto(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setMaisAberto(false)}
            accessibilityLabel="Fechar"
          />
          <View
            style={[
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                paddingTop: spacing.md,
                paddingBottom: insets.bottom + spacing.md,
                paddingHorizontal: spacing.lg,
              },
              shadow.lg,
            ]}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: spacing.sm,
              }}>
              <Text variant="h3" style={{ flex: 1 }}>
                Mais
              </Text>
              <Pressable
                onPress={() => setMaisAberto(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Fechar">
                <Icon name="close" size="lg" color={colors.textSecondary} />
              </Pressable>
            </View>

            {escondidos.map((d, i) => (
              <Pressable
                key={d.nome}
                onPress={() => {
                  setMaisAberto(false);
                  router.navigate(d.rota);
                }}
                accessibilityRole="link"
                accessibilityLabel={d.label}
                accessibilityState={{ selected: rotaAtual === d.nome }}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    // Alvo grande: é uma folha usada com o polegar, muitas
                    // vezes de pé no campo.
                    minHeight: 60,
                    borderBottomWidth: i < escondidos.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  },
                  pressed && { opacity: 0.6 },
                ]}>
                <Icon
                  name={d.icon}
                  size="lg"
                  color={rotaAtual === d.nome ? colors.primary : colors.textSecondary}
                />
                <Text
                  variant={rotaAtual === d.nome ? 'bodyStrong' : 'body'}
                  color={rotaAtual === d.nome ? colors.primaryDark : colors.text}
                  style={{ flex: 1 }}>
                  {d.label}
                </Text>
                <Icon name="chevron-right" size="md" color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Botao({
  label,
  icon,
  focused,
  onPress,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
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
        <Icon name={icon} size={26} color={focused ? colors.primary : colors.textMuted} />
      </View>
      <Text variant="caption" color={focused ? colors.primaryDark : colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const desktop = useDesktop();

  const ecrans = (
    <Tabs
      tabBar={desktop ? () => null : (props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      {DESTINOS.map((d) => (
        <Tabs.Screen key={d.nome} name={d.nome} />
      ))}
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
