import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Card, EmptyState, FAB, Icon, IconBadge, Text } from '@/components/ui';
import { tipoTerrenoMeta } from '@/data/constants';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { agruparTerrenosPorExploracao, emLinhas } from '@/data/terrenos';
import type { Terreno } from '@/data/types';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, spacing } from '@/theme';

/**
 * Todos os terrenos, de todas as explorações, num sítio só — mas separados por
 * exploração.
 *
 * Até aqui os terrenos só existiam dentro da ficha da exploração: para ver onde
 * está o gado era preciso saber primeiro a que exploração pertence, o que é uma
 * pergunta que o criador não faz. Depois passaram a estar todos nesta lista, e
 * apareceu o problema oposto — os de duas quintas seguidos uns aos outros, sem
 * nada a marcar onde uma acaba e a outra começa.
 *
 * Cada exploração tem agora o seu grupo, com o nome no cabeçalho e o botão de
 * criar ali mesmo: o terreno novo nasce na exploração que se está a ver, e não
 * na primeira da lista.
 */
export default function TerrenosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { terrenos, exploracoes, animais } = useGado();
  const { pode } = useMembros();
  const { controlo: controloAtualizar } = useAtualizarPuxando();

  // Quantos animais em cada terreno — é a informação que dá sentido à lista.
  // Só o efetivo ativo: contar falecidos e vendidos dava um número que não
  // corresponde a nada que se veja no campo.
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of animais) {
      if (!a.terrenoId || (a.estado && a.estado !== 'ativo')) continue;
      m.set(a.terrenoId, (m.get(a.terrenoId) ?? 0) + 1);
    }
    return m;
  }, [animais]);

  const colunas = desktop ? 2 : 1;

  // Uma secção por exploração (ver `terrenos.ts`), com os terrenos já em linhas
  // de uma ou duas colunas — uma lista por secções não tem `numColumns`.
  const secoes = useMemo(
    () =>
      agruparTerrenosPorExploracao(terrenos, exploracoes).map((g) => ({
        ...g,
        data: emLinhas(g.terrenos, colunas),
      })),
    [terrenos, exploracoes, colunas],
  );

  function criarEm(exploracaoId: string) {
    router.push({ pathname: '/terreno/novo', params: { exploracaoId } });
  }

  // Para a lista inteira estar vazia basta não haver terreno nenhum: as
  // explorações sem terrenos aparecem como grupos vazios, com o seu convite.
  const semTerrenos = terrenos.length === 0;
  const primeiraEditavel = exploracoes.find((e) => pode(e.id, 'gerirTerrenos'));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        // Ver nota em animais.tsx: mudar o número de colunas exige remontar.
        key={desktop ? 'grelha' : 'pilha'}
        sections={secoes}
        keyExtractor={(linha) => linha.map((t) => t.id).join('+')}
        renderItem={({ item: linha }) => (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {linha.map((t) => (
              <View key={t.id} style={{ flex: 1 }}>
                <TerrenoRow
                  terreno={t}
                  animais={contagem.get(t.id) ?? 0}
                  onPress={() => router.push(`/terreno/${t.id}`)}
                />
              </View>
            ))}
            {/* Uma linha ímpar em duas colunas deixa metade por preencher: sem
                este vazio, o último cartão esticava para o dobro da largura. */}
            {linha.length < colunas ? <View style={{ flex: linha.length }} /> : null}
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <CabecalhoExploracao
            nome={section.nome}
            quantos={section.terrenos.length}
            onNovo={
              section.exploracaoId && pode(section.exploracaoId, 'gerirTerrenos')
                ? () => criarEm(section.exploracaoId!)
                : undefined
            }
          />
        )}
        renderSectionFooter={({ section }) =>
          section.terrenos.length === 0 ? (
            <Card style={{ marginBottom: spacing.md }}>
              <Text variant="secondary" color={colors.textSecondary}>
                Esta exploração ainda não tem terrenos registados.
              </Text>
            </Card>
          ) : (
            <View style={{ height: spacing.sm }} />
          )
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={controloAtualizar}
        contentContainerStyle={{
          width: '100%',
          maxWidth: desktop ? layout.conteudoDesktop : undefined,
          alignSelf: 'center',
          paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
          paddingBottom: spacing.huge + 40,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.md }}>
            <Text variant="display">Terrenos</Text>
            <Text variant="body" color={colors.textSecondary}>
              {semTerrenos
                ? 'Onde o gado anda'
                : `${terrenos.length} ${terrenos.length === 1 ? 'terreno' : 'terrenos'}`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="grass"
            title="Sem terrenos"
            message={
              exploracoes.length === 0
                ? 'Crie primeiro uma exploração — os terrenos pertencem a uma.'
                : 'Registe os terrenos onde o gado anda para saber onde está cada animal.'
            }
            actionLabel={primeiraEditavel ? 'Novo terreno' : undefined}
            onAction={primeiraEditavel ? () => criarEm(primeiraEditavel.id) : undefined}
          />
        }
      />
      {/* O botão flutuante só faz sentido quando há UMA exploração: com várias,
          criar é dentro do grupo certo — o "Novo" do cabeçalho — em vez de
          adivinhar a primeira da lista. */}
      {primeiraEditavel && exploracoes.length === 1 && !semTerrenos ? (
        <FAB label="Novo" onPress={() => criarEm(primeiraEditavel.id)} />
      ) : null}
    </View>
  );
}

/** Nome da exploração, quantos terrenos tem, e o atalho para criar mais um. */
function CabecalhoExploracao({
  nome,
  quantos,
  onNovo,
}: {
  nome: string;
  quantos: number;
  onNovo?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingBottom: spacing.xs,
        // O fundo é o que impede o cabeçalho de se confundir com um cartão
        // quando a lista rola por trás dele.
        backgroundColor: colors.background,
      }}>
      <Icon name="barn" size="sm" color={colors.textSecondary} />
      <Text variant="label" color={colors.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
        {nome.toUpperCase()}
        <Text variant="caption" color={colors.textMuted}>
          {'  '}
          {quantos}
        </Text>
      </Text>
      {onNovo ? (
        <Pressable
          onPress={onNovo}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Novo terreno em ${nome}`}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 2 },
            pressed && { opacity: 0.6 },
          ]}>
          <Icon name="plus" size="sm" color={colors.primary} />
          <Text variant="caption" color={colors.primary}>
            NOVO
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TerrenoRow({
  terreno,
  animais,
  onPress,
}: {
  terreno: Terreno;
  animais: number;
  onPress: () => void;
}) {
  const meta = tipoTerrenoMeta[terreno.tipo ?? 'Outro'];

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${terreno.nome}, ${animais} animais`}
      style={{ marginBottom: spacing.sm }}
      padded={false}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.sm,
        }}>
        <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={52} iconSize={28} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {terreno.nome}
            </Text>
            {terreno.latitude != null && terreno.longitude != null ? (
              <Icon name="map-marker-check" size={16} color={colors.primary} />
            ) : null}
          </View>
          <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
            {terreno.tipo ?? 'Sem tipo'}
            {terreno.area != null ? ` · ${terreno.area} ha` : ''}
          </Text>
        </View>
        <Badge
          tone={animais > 0 ? 'brand' : 'neutral'}
          icon="cow"
          label={String(animais)}
        />
        <Icon name="chevron-right" size="md" color={colors.textMuted} />
      </View>
    </Card>
  );
}
