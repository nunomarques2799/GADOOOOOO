import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimalRow } from '@/components/AnimalRow';
import { Chip, EmptyState, FAB, Icon, Text } from '@/components/ui';
import { especieMeta, especies } from '@/data/constants';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import type { Especie } from '@/data/types';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

type Filtro = 'Todos' | Especie;

export default function AnimaisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { animais, alertas } = useGado();
  // Com a conta suspensa nada se grava — o formulário só levaria a um erro no
  // fim. O papel não se verifica aqui porque a exploração ainda não está
  // escolhida (é o formulário que a pede); isso fica para o `guardar`.
  const { contaSuspensa } = useMembros();

  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [soAlertas, setSoAlertas] = useState(false);
  const [incluirSaidos, setIncluirSaidos] = useState(false);

  // Conjunto de animais com pelo menos um alerta pendente.
  const idsComAlerta = useMemo(
    () => new Set(alertas.map((al) => al.animalId).filter((id): id is string => !!id)),
    [alertas],
  );

  const ativos = useMemo(
    () => animais.filter((a) => !a.estado || a.estado === 'ativo'),
    [animais],
  );
  const saidos = useMemo(
    () => animais.filter((a) => a.estado === 'falecido' || a.estado === 'vendido'),
    [animais],
  );
  const universo = incluirSaidos ? animais : ativos;

  // Espécies efetivamente presentes no efetivo (só ativos, para não sujar o filtro)
  const filtrosDisponiveis = useMemo<Filtro[]>(() => {
    const presentes = especies.filter((e) => ativos.some((a) => a.especie === e));
    return ['Todos', ...presentes];
  }, [ativos]);

  const lista = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universo
      .filter((a) => filtro === 'Todos' || a.especie === filtro)
      .filter((a) => !soAlertas || idsComAlerta.has(a.id))
      .filter((a) => {
        if (!q) return true;
        return (
          a.nome?.toLowerCase().includes(q) ||
          a.numeroIdentificacao?.toLowerCase().includes(q) ||
          a.raca?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''));
  }, [universo, filtro, query, soAlertas, idsComAlerta]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        // numColumns não muda a quente — a key força a lista a remontar
        // quando se passa de telemóvel (pilha) para desktop (grelha).
        key={desktop ? 'grelha' : 'pilha'}
        data={lista}
        keyExtractor={(a) => a.id}
        numColumns={desktop ? 2 : 1}
        columnWrapperStyle={desktop ? { gap: spacing.sm } : undefined}
        renderItem={({ item }) =>
          desktop ? (
            <View style={{ flex: 1 }}>
              <AnimalRow animal={item} />
            </View>
          ) : (
            <AnimalRow animal={item} />
          )
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: desktop ? layout.conteudoDesktop : undefined,
          alignSelf: 'center',
          paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
          paddingBottom: spacing.huge + 40,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text variant="display">Animais</Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 6 }}>
                {ativos.length} no efetivo
              </Text>
            </View>

            {/* Pesquisa */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                backgroundColor: colors.surface,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                height: 52,
                marginBottom: spacing.md,
              }}>
              <Icon name="magnify" size="md" color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Procurar por nome, brinco ou raça"
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  fontFamily: 'Nunito_500Medium',
                  fontSize: 16,
                  color: colors.text,
                }}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            {/* Filtros rápidos: alertas e arquivo (falecidos/vendidos) */}
            {idsComAlerta.size > 0 || saidos.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
                {idsComAlerta.size > 0 ? (
                  <Chip
                    label={`Com alertas (${idsComAlerta.size})`}
                    icon="alert-circle-outline"
                    selected={soAlertas}
                    onPress={() => setSoAlertas((v) => !v)}
                  />
                ) : null}
                {saidos.length > 0 ? (
                  <Chip
                    label={`Mostrar arquivo (${saidos.length})`}
                    icon="archive-outline"
                    selected={incluirSaidos}
                    onPress={() => setIncluirSaidos((v) => !v)}
                  />
                ) : null}
              </View>
            ) : null}

            {/* Filtros por espécie */}
            <FlatList
              horizontal
              data={filtrosDisponiveis}
              keyExtractor={(f) => f}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.md }}
              renderItem={({ item }) => (
                <Chip
                  label={item === 'Todos' ? 'Todos' : especieMeta[item].plural}
                  icon={item === 'Todos' ? 'paw' : especieMeta[item].icon}
                  selected={filtro === item}
                  onPress={() => setFiltro(item)}
                />
              )}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cow-off"
            title="Nenhum animal encontrado"
            message={
              query || filtro !== 'Todos' || soAlertas
                ? 'Experimente ajustar a pesquisa ou os filtros.'
                : 'Ainda não há animais registados. Comece por adicionar o primeiro.'
            }
            actionLabel={
              !contaSuspensa && !query && filtro === 'Todos' && !soAlertas
                ? 'Registar animal'
                : undefined
            }
            onAction={() => router.push('/animal/novo')}
          />
        }
      />
      {contaSuspensa ? null : (
        <FAB label="Registar" onPress={() => router.push('/animal/novo')} />
      )}
    </View>
  );
}
