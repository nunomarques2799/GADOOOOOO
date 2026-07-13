import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploracaoRow } from '@/components/ExploracaoRow';
import { EmptyState, FAB, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors, spacing } from '@/theme';

export default function ExploracoesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { exploracoes } = useGado();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={exploracoes}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <ExploracaoRow exploracao={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.huge + 40,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.md }}>
            <Text variant="display">Explorações</Text>
            <Text variant="body" color={colors.textSecondary}>
              As suas explorações pecuárias
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="barn"
            title="Sem explorações"
            message="Crie a sua primeira exploração para começar a registar terrenos e animais."
            actionLabel="Nova exploração"
            onAction={() => {}}
          />
        }
      />
      <FAB label="Nova" onPress={() => {}} />
    </View>
  );
}
