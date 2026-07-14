import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploracaoRow } from '@/components/ExploracaoRow';
import { EmptyState, FAB, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { colors, spacing } from '@/theme';

export default function ExploracoesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { exploracoes } = useGado();
  const { estadoPerfil, isSuperadmin } = useMembros();
  // Só clientes aprovados (perfil ativo) podem criar explorações. Membros por
  // convite (trabalhador/veterinário) veem as suas mas não criam novas.
  const podeCriar = estadoPerfil === 'ativo' || isSuperadmin;

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
            message={
              podeCriar
                ? 'Crie a sua primeira exploração para começar a registar terrenos e animais.'
                : 'Ainda não foi associado a nenhuma exploração. Peça um código ao cliente responsável.'
            }
            actionLabel={podeCriar ? 'Nova exploração' : undefined}
            onAction={podeCriar ? () => router.push('/exploracao/nova') : undefined}
          />
        }
      />
      {podeCriar ? <FAB label="Nova" onPress={() => router.push('/exploracao/nova')} /> : null}
    </View>
  );
}
