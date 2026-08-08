import { Tabs, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolhaAcoesRapidas } from '@/components/AcoesRapidas';
import { BarraLateral, type ItemNav } from '@/components/BarraLateral';
import { Icon, type IconName, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import type { CapacidadeLeitura } from '@/data/permissoes';
import { useExistencias } from '@/data/useExistencias';
import { t, type ChaveTexto } from '@/i18n';
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
type Destino = {
  nome: string;
  rota: Rota;
  /**
   * A CHAVE do rótulo, não o rótulo.
   *
   * Esta tabela é criada ao importar o módulo, e o `t()` lê o idioma de uma
   * variável que o arranque preenche — uma string resolvida aqui ficava
   * congelada na língua de origem, exatamente como acontece com as cores lidas
   * fora do render (ver a nota do `colors` no AGENTS.md). Com a chave, quem
   * desenha é que traduz.
   */
  chave: ChaveTexto;
  icon: IconName;
  /** Só aparece a quem gere a equipa de alguma exploração. */
  soComEquipa?: boolean;
  /**
   * Só aparece a quem pode CONSULTAR isto nalguma exploração. Serve os
   * separadores que um convidado não tem que abrir: as contas da exploração e
   * os ficheiros com o efetivo lá dentro.
   */
  exigeLeitura?: CapacidadeLeitura;
  /**
   * Só aparece se o criador tiver LIGADO a funcionalidade nas Definições.
   *
   * É diferente do `exigeLeitura`: aquele é sobre o que este PAPEL pode ver,
   * este é sobre o que a CONTA escolheu ter. As finanças precisam dos dois (só
   * o dono liga, e nem toda a equipa vê as contas depois de ligadas); as
   * existências só deste — ligada a arrecadação, quem trata dos animais precisa
   * de escolher o frasco de onde saiu a dose, seja trabalhador ou veterinário.
   */
  exigeInterruptor?: 'existencias';
};

/**
 * Os destinos, pela ordem em que aparecem na barra lateral.
 * `nome` é o ficheiro dentro de `(tabs)/`; `rota` é o URL (o grupo `(tabs)`
 * não aparece no caminho, por isso `(tabs)/alertas.tsx` serve `/alertas`).
 *
 * `soComEquipa` marca os que só fazem sentido a quem tem equipa para gerir:
 * um trabalhador convidado não vê a lista de colegas (a RLS também não lha
 * daria), e um destino que abre sempre vazio é um destino a mais na barra.
 */
const DESTINOS: Destino[] = [
  { nome: 'index', rota: '/', chave: 'nav.inicio', icon: 'home-variant' },
  { nome: 'exploracoes', rota: '/exploracoes', chave: 'nav.exploracoes', icon: 'barn' },
  { nome: 'terrenos', rota: '/terrenos', chave: 'nav.terrenos', icon: 'grass' },
  { nome: 'animais', rota: '/animais', chave: 'nav.animais', icon: 'cow' },
  { nome: 'alertas', rota: '/alertas', chave: 'nav.alertas', icon: 'bell-outline' },
  { nome: 'reproducao', rota: '/reproducao', chave: 'nav.reproducao', icon: 'heart-pulse' },
  {
    nome: 'medicamentos',
    rota: '/medicamentos',
    chave: 'nav.existencias',
    icon: 'package-variant-closed',
    exigeInterruptor: 'existencias',
  },
  {
    nome: 'trabalhadores',
    rota: '/trabalhadores',
    chave: 'nav.trabalhadores',
    icon: 'account-hard-hat',
    soComEquipa: true,
  },
  {
    nome: 'financas',
    rota: '/financas',
    chave: 'nav.financas',
    icon: 'cash-multiple',
    exigeLeitura: 'verFinancas',
  },
  {
    nome: 'documentos',
    rota: '/documentos',
    chave: 'nav.documentos',
    icon: 'file-document-outline',
    exigeLeitura: 'verDocumentos',
  },
  { nome: 'definicoes', rota: '/definicoes', chave: 'nav.definicoes', icon: 'cog-outline' },
  { nome: 'perfil', rota: '/perfil', chave: 'nav.perfil', icon: 'account' },
];

/**
 * A barra de baixo do TELEMÓVEL, pela ordem em que aparece.
 *
 * São cinco lugares para os doze destinos do `DESTINOS`: a barra reparte a
 * largura por todos, e com doze cada um ficaria espremido num ecrã de 375px —
 * bem menos ainda com a letra do sistema no máximo, que é o cenário que esta
 * app tem de aguentar.
 *
 * O `'+'` do meio não é um destino: é o botão de REGISTAR, e abre a folha das
 * ações rápidas (`FolhaAcoesRapidas`). Está aqui porque esta app usa-se para
 * apontar o que se acabou de fazer — a vacina, o parto, a despesa — e isso
 * estava a três toques de distância (Início → rolar até às ações rápidas →
 * escolher), com o Início a ter de estar aberto. Ao meio e em destaque, é o
 * alvo mais fácil de acertar com o polegar de qualquer ecrã da app.
 *
 * As Explorações saíram daqui para o "Mais": abrem-se para consultar ou para
 * mexer numa configuração, não a cada bocado. O que se faz todos os dias é ver
 * o Início, procurar um animal, registar, e ver o que está a arder.
 *
 * No computador não há este problema: a barra lateral é vertical e leva-os
 * todos — e lá não há botão "+" nenhum, porque as ações rápidas estão à vista
 * no Início sem ter de rolar.
 */
const BARRA_TELEMOVEL = ['index', 'animais', '+', 'alertas'] as const;

/** Os destinos que a barra mostra (o `'+'` não é destino). */
const NO_TELEMOVEL: string[] = BARRA_TELEMOVEL.filter((n) => n !== '+');

/**
 * Os destinos que esta pessoa pode ver. A rota continua declarada (quem chegar
 * lá por um link encontra o ecrã, que se explica a si mesmo) — o que se filtra
 * é a NAVEGAÇÃO, para ninguém tropeçar num ecrã que a RLS lhe fecha.
 */
function useDestinos(): Destino[] {
  const { podeEmAlguma, podeVer } = useMembros();
  const comEquipa = podeEmAlguma('gerirEquipa');
  // `podeVer(undefined, …)` responde por QUALQUER exploração de que se seja
  // membro: quem tem duas quintas e as contas ligadas só numa continua a ver o
  // separador. É a mesma pergunta que os ecrãs de dentro fazem.
  const comFinancas = podeVer(undefined, 'verFinancas');
  const comDocumentos = podeVer(undefined, 'verDocumentos');
  const { ativas: comExistencias } = useExistencias();

  return useMemo(
    () =>
      DESTINOS.filter((d) => {
        if (d.soComEquipa && !comEquipa) return false;
        if (d.exigeInterruptor === 'existencias' && !comExistencias) return false;
        if (d.exigeLeitura === 'verFinancas') return comFinancas;
        if (d.exigeLeitura === 'verDocumentos') return comDocumentos;
        return true;
      }),
    [comEquipa, comFinancas, comDocumentos, comExistencias],
  );
}

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const destinos = useDestinos();
  const [maisAberto, setMaisAberto] = useState(false);
  const [registarAberto, setRegistarAberto] = useState(false);

  const escondidos = destinos.filter((d) => !NO_TELEMOVEL.includes(d.nome));
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
            // Centrado, e não encostado ao topo: a coluna do "+" é mais alta
            // do que as outras (o círculo é maior do que a pastilha), e a
            // encostar ao topo os quatro rótulos ficavam a alturas diferentes.
            alignItems: 'center',
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
        {BARRA_TELEMOVEL.map((nome) => {
          if (nome === '+') return <BotaoRegistar key="+" onPress={() => setRegistarAberto(true)} />;

          const route = state.routes.find((r) => r.name === nome);
          const cfg = destinos.find((d) => d.nome === nome);
          if (!route || !cfg) return null;
          const focused = rotaAtual === nome;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(nome);
          };

          return (
            <Botao
              key={route.key}
              label={t(cfg.chave)}
              icon={cfg.icon}
              focused={focused}
              onPress={onPress}
            />
          );
        })}
        <Botao
          label={t('nav.mais')}
          icon="dots-horizontal"
          focused={maisAtivo}
          onPress={() => setMaisAberto(true)}
        />
      </View>

      {/* O que o "+" abre. Montada aqui, ao lado da barra, para estar acessível
          de qualquer separador. */}
      <FolhaAcoesRapidas aberto={registarAberto} onFechar={() => setRegistarAberto(false)} />

      <Modal
        visible={maisAberto}
        animationType="slide"
        transparent
        onRequestClose={() => setMaisAberto(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setMaisAberto(false)}
            accessibilityLabel={t('comum.fechar')}
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
                {t('nav.mais')}
              </Text>
              <Pressable
                onPress={() => setMaisAberto(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('comum.fechar')}>
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
                accessibilityLabel={t(d.chave)}
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
                  {t(d.chave)}
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

/**
 * O botão do meio — o que abre "Registar".
 *
 * Círculo CHEIO da cor de marca, e não a pastilha dos outros: os quatro
 * separadores levam a sítios, este faz uma coisa, e a diferença tem de se ver
 * antes de se ler o rótulo. É também o maior alvo da barra, de propósito — é o
 * botão mais usado da app e quem lhe acerta muitas vezes tem 82 anos e o
 * telemóvel numa mão só.
 */
function BotaoRegistar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('nav.registar')}
      accessibilityHint={t('nav.registarAjuda')}
      style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 }}>
      <View
        style={[
          {
            width: 52,
            height: 52,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
          },
          shadow.md,
        ]}>
        <Icon name="plus" size={30} color={colors.onPrimary} />
      </View>
      <Text variant="caption" color={colors.primaryDark}>
        {t('nav.registar')}
      </Text>
    </Pressable>
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
  const destinos = useDestinos();

  const navDesktop: ItemNav[] = destinos.map((d) => ({
    rota: d.rota,
    label: t(d.chave),
    icon: d.icon,
  }));

  const ecrans = (
    <Tabs
      tabBar={desktop ? () => null : (props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      {/* Todas as rotas declaradas, mesmo as que esta pessoa não vê na
          navegação: retirá-las daqui fazia o expo-router dar 404 a um link
          direto, e o ecrã já sabe explicar-se a quem não tem equipa. */}
      {DESTINOS.map((d) => (
        <Tabs.Screen key={d.nome} name={d.nome} />
      ))}
    </Tabs>
  );

  if (!desktop) return ecrans;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <BarraLateral itens={navDesktop} />
      <View style={{ flex: 1 }}>{ecrans}</View>
    </View>
  );
}
