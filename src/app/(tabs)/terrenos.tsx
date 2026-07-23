import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Card, EmptyState, FAB, Icon, IconBadge, Text } from '@/components/ui';
import { tipoTerrenoMeta } from '@/data/constants';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import type { Terreno } from '@/data/types';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, spacing } from '@/theme';

/**
 * Todos os terrenos, de todas as explorações, num sítio só.
 *
 * Até aqui os terrenos só existiam dentro da ficha da exploração — para ver
 * onde está o gado era preciso saber primeiro a que exploração pertence, o que
 * é uma pergunta que o criador não faz. Quem tem uma exploração só passava por
 * dois ecrãs para chegar a uma lista de três terrenos.
 */
export default function TerrenosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { terrenos, exploracoes, animais } = useGado();
  const { pode } = useMembros();

  // Só se oferece criar quando há onde: o formulário exige uma exploração.
  const podeCriar =
    exploracoes.length > 0 && exploracoes.some((e) => pode(e.id, 'gerirTerrenos'));

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

  const nomeExploracao = useMemo(
    () => new Map(exploracoes.map((e) => [e.id, e.nome])),
    [exploracoes],
  );

  // Agrupados por exploração e depois por nome: com mais do que uma exploração,
  // uma lista alfabética misturava terrenos de sítios diferentes.
  const lista = useMemo(
    () =>
      [...terrenos].sort((a, b) => {
        const ea = nomeExploracao.get(a.exploracaoId) ?? '';
        const eb = nomeExploracao.get(b.exploracaoId) ?? '';
        if (ea !== eb) return ea.localeCompare(eb, 'pt');
        return a.nome.localeCompare(b.nome, 'pt');
      }),
    [terrenos, nomeExploracao],
  );

  const varias = exploracoes.length > 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        // Ver nota em animais.tsx: numColumns exige remontar a lista.
        key={desktop ? 'grelha' : 'pilha'}
        data={lista}
        keyExtractor={(t) => t.id}
        numColumns={desktop ? 2 : 1}
        columnWrapperStyle={desktop ? { gap: spacing.sm } : undefined}
        renderItem={({ item }) => {
          const linha = (
            <TerrenoRow
              terreno={item}
              animais={contagem.get(item.id) ?? 0}
              exploracao={varias ? nomeExploracao.get(item.exploracaoId) : undefined}
              onPress={() => router.push(`/terreno/${item.id}`)}
            />
          );
          return desktop ? <View style={{ flex: 1 }}>{linha}</View> : linha;
        }}
        showsVerticalScrollIndicator={false}
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
              {terrenos.length === 0
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
            actionLabel={podeCriar ? 'Novo terreno' : undefined}
            onAction={
              podeCriar
                ? () =>
                    router.push({
                      pathname: '/terreno/novo',
                      params: { exploracaoId: exploracoes[0].id },
                    })
                : undefined
            }
          />
        }
      />
      {podeCriar && terrenos.length > 0 ? (
        <FAB
          label="Novo"
          onPress={() =>
            router.push({
              pathname: '/terreno/novo',
              params: { exploracaoId: exploracoes[0].id },
            })
          }
        />
      ) : null}
    </View>
  );
}

function TerrenoRow({
  terreno,
  animais,
  exploracao,
  onPress,
}: {
  terreno: Terreno;
  animais: number;
  /** Só vem preenchido quando há mais do que uma exploração. */
  exploracao?: string;
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
          {exploracao ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <Icon name="barn" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {exploracao}
              </Text>
            </View>
          ) : null}
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
