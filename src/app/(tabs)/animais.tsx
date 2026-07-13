import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimalRow } from '@/components/AnimalRow';
import { Chip, EmptyState, FAB, Icon, Text } from '@/components/ui';
import { especieMeta, especies } from '@/data/constants';
import { useGado } from '@/data/store';
import type { Especie } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

type Filtro = 'Todos' | Especie;

export default function AnimaisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { animais } = useGado();

  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('Todos');

  // Espécies efetivamente presentes no efetivo
  const filtrosDisponiveis = useMemo<Filtro[]>(() => {
    const presentes = especies.filter((e) => animais.some((a) => a.especie === e));
    return ['Todos', ...presentes];
  }, [animais]);

  const lista = useMemo(() => {
    const q = query.trim().toLowerCase();
    return animais
      .filter((a) => filtro === 'Todos' || a.especie === filtro)
      .filter((a) => {
        if (!q) return true;
        return (
          a.nome?.toLowerCase().includes(q) ||
          a.numeroIdentificacao?.toLowerCase().includes(q) ||
          a.raca?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''));
  }, [animais, filtro, query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={lista}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AnimalRow animal={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.huge + 40,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text variant="display">Animais</Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 6 }}>
                {animais.length} no efetivo
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
              query || filtro !== 'Todos'
                ? 'Experimente ajustar a pesquisa ou os filtros.'
                : 'Ainda não há animais registados. Comece por adicionar o primeiro.'
            }
            actionLabel={!query && filtro === 'Todos' ? 'Registar animal' : undefined}
            onAction={() => router.push('/animal/novo')}
          />
        }
      />
      <FAB label="Registar" onPress={() => router.push('/animal/novo')} />
    </View>
  );
}
