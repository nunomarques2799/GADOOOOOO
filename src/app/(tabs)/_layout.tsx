import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolhaAcoesRapidas } from '@/components/AcoesRapidas';
import { BarraLateral, type ItemNav } from '@/components/BarraLateral';
import { DESTINOS, useDestinos } from '@/components/destinosNavegacao';
import { Icon, type IconName, Text } from '@/components/ui';
import {
  ATALHOS_OMISSAO,
  ATALHOS_OMISSAO_SUPERVISOR,
  atalhosDaBarra,
  useAtalhosEscolhidos,
} from '@/data/barraAtalhos';
import { useMembros } from '@/data/membros';
import { useNaoLidas } from '@/data/useChat';
import { voltarAoTopo } from '@/data/voltarAoTopo';
import { t } from '@/i18n';
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

/**
 * A barra de baixo do TELEMÓVEL: Início | atalho | Registar | atalho | Mais.
 *
 * Cinco lugares, e só dois são escolhidos por quem usa a app (Definições →
 * Atalhos da barra; ver `barraAtalhos.ts`). Eram sete fixos, e sete colunas
 * num ecrã de 375px ficavam estreitas de mais para a letra grande que esta app
 * tem de aguentar.
 *
 * O Registar do meio não é um destino: é o botão que abre a folha das ações
 * rápidas (`FolhaAcoesRapidas`). Está ao meio porque esta app usa-se para
 * apontar o que se acabou de fazer (a vacina, o parto, a despesa), e o meio é
 * o alvo mais fácil de acertar com o polegar sem olhar. Com dois atalhos de
 * cada lado (Início e um atalho à esquerda, um atalho e o Mais à direita) fica
 * sempre ao centro.
 *
 * No computador não há este problema: a barra lateral é vertical e leva-os
 * todos, e lá não há botão Registar nenhum, porque as ações rápidas estão à
 * vista no Início sem ter de rolar.
 */
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const destinos = useDestinos();
  const [maisAberto, setMaisAberto] = useState(false);
  const [registarAberto, setRegistarAberto] = useState(false);
  const naoLidas = useNaoLidas();
  const { isSupervisorEmAlguma } = useMembros();
  const escolha = useAtalhosEscolhidos();

  const [esquerda, direita] = atalhosDaBarra(
    escolha,
    destinos.map((d) => d.nome),
    isSupervisorEmAlguma ? ATALHOS_OMISSAO_SUPERVISOR : ATALHOS_OMISSAO,
  );
  const naBarra = ['index', esquerda, '+', direita].filter((n): n is string => !!n);
  // O "Mais" guarda o que a barra deixou de fora: as duas leem a MESMA lista.
  const escondidos = destinos.filter((d) => !naBarra.includes(d.nome));
  // Com o Chat fora da barra, o ponto das mensagens por ler passa para o
  // "Mais" (e para a linha do Chat lá dentro). Senão uma mensagem nova ficava
  // sem sinal nenhum em lado nenhum da barra.
  const porLerNoMais = escondidos.some((d) => d.nome === 'chat') ? naoLidas : 0;
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
            paddingHorizontal: 0,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
          },
          shadow.lg,
        ]}>
        {naBarra.map((nome) => {
          if (nome === '+') return <BotaoRegistar key="+" onPress={() => setRegistarAberto(true)} />;

          const route = state.routes.find((r) => r.name === nome);
          const cfg = destinos.find((d) => d.nome === nome);
          if (!route || !cfg) return null;
          const focused = rotaAtual === nome;

          const onPress = () => {
            // Já se está neste separador: o toque volta ao topo da lista, que é
            // o que este gesto faz em todo o lado. Antes não fazia nada, e quem
            // tinha rolado até ao fim do Início voltava para trás a arrastar o
            // dedo. Sem lista registada (um ecrã que não rola) não acontece
            // nada, como dantes.
            if (focused) {
              voltarAoTopo(nome);
              return;
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) navigation.navigate(nome);
          };

          return (
            <Botao
              key={route.key}
              label={t(cfg.curto ?? cfg.chave)}
              icon={cfg.icon}
              focused={focused}
              onPress={onPress}
              porLer={nome === 'chat' ? naoLidas : 0}
            />
          );
        })}
        <Botao
          label={t('nav.mais')}
          icon="dots-horizontal"
          focused={maisAtivo}
          onPress={() => setMaisAberto(true)}
          porLer={porLerNoMais}
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
                {d.nome === 'chat' && porLerNoMais > 0 ? (
                  <View
                    accessibilityLabel={t('chat.naoLidasN', { n: porLerNoMais })}
                    style={{
                      minWidth: 24,
                      height: 24,
                      paddingHorizontal: 6,
                      borderRadius: radii.pill,
                      backgroundColor: colors.danger,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text variant="caption" color={colors.onPrimary}>
                      {porLerNoMais > 99 ? '99+' : porLerNoMais}
                    </Text>
                  </View>
                ) : null}
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
      <Text variant="caption" color={colors.primaryDark} numberOfLines={1}>
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
  porLer = 0,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
  /** Quantas mensagens por ler. Zero não desenha nada. */
  porLer?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={
        porLer > 0 ? `${label}, ${t('chat.naoLidasN', { n: porLer })}` : label
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
        <Icon name={icon} size={26} color={focused ? colors.primary : colors.textMuted} />
        {/* O ponto das mensagens por ler. Sem número lá dentro de propósito:
            num ícone de 26px, um "12" fica ilegível, e o que interessa saber
            é que há alguma coisa para ler. A conta certa está na lista. */}
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
      {/* O `numberOfLines` não é enfeite: com a letra do sistema no máximo (o
          cenário dos 258px do AGENTS.md), "Terrenos" mede mais do que a sua
          coluna e, sem isto, escrevia-se por cima do vizinho. Cortado com
          reticências fica feio e legível, que é a ordem certa. */}
      <Text
        variant="caption"
        color={focused ? colors.primaryDark : colors.textMuted}
        numberOfLines={1}>
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
