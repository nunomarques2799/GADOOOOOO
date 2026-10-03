import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Logotipo } from '@/components/Logotipo';
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
        <Logotipo tamanho={44} />
        <Text variant="h2" color={colors.textOnDark}>
          Terrabovina
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

/**
 * Os ecrãs que não são separadores, e a que separador pertencem.
 *
 * Desde que a barra ficou à vista também nas fichas e nos formulários, uma
 * barra sem nada aceso na ficha da Mimosa parecia uma app perdida. Os URLs das
 * fichas estão no singular (`/animal/…`) e os separadores no plural
 * (`/animais`), por isso a correspondência por prefixo não chegava. A ORDEM
 * conta: o primeiro prefixo que bate é que manda (a conta do Perfil antes das
 * definições, que partilham o `/conta/`).
 */
const SECCAO_DE: [prefixo: string, rota: string][] = [
  ['/animal/', '/animais'],
  ['/evento/', '/animais'],
  ['/exploracao/', '/exploracoes'],
  ['/terreno/', '/terrenos'],
  ['/medicamento/', '/medicamentos'],
  ['/movimento/', '/financas'],
  ['/chat/', '/chat'],
  ['/agenda/', '/'],
  ['/equipa/', '/trabalhadores'],
  ['/atividade', '/trabalhadores'],
  ['/snira', '/documentos'],
  ['/conta/editar', '/perfil'],
  ['/conta/entrar', '/perfil'],
  ['/conta/apagar', '/perfil'],
  ['/conta/sincronizacao', '/perfil'],
  ['/conta/', '/definicoes'],
];

/** A raiz só é ativa em correspondência exata; as outras cobrem sub-rotas. */
export function estaAtivo(pathname: string, rota: Rota) {
  if (pathname === rota) return true;
  const seccao = SECCAO_DE.find(([prefixo]) => pathname.startsWith(prefixo));
  if (seccao) return seccao[1] === rota;
  if (rota === '/') return false;
  return pathname.startsWith(`${rota}/`);
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
