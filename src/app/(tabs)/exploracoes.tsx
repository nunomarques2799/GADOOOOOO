import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploracaoRow } from '@/components/ExploracaoRow';
import { EmptyState, FAB, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, spacing } from '@/theme';

export default function ExploracoesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { exploracoes } = useGado();
  const { estadoPerfil, isSuperadmin } = useMembros();
  // Só clientes aprovados (perfil ativo) podem criar explorações. Membros por
  // convite (trabalhador/veterinário) veem as suas mas não criam novas.
  const podeCriar = estadoPerfil === 'ativo' || isSuperadmin;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        // Ver nota em animais.tsx: numColumns exige remontar a lista.
        key={desktop ? 'grelha' : 'pilha'}
        data={exploracoes}
        keyExtractor={(e) => e.id}
        numColumns={desktop ? 2 : 1}
        columnWrapperStyle={desktop ? { gap: spacing.sm } : undefined}
        renderItem={({ item }) =>
          desktop ? (
            <View style={{ flex: 1 }}>
              <ExploracaoRow exploracao={item} />
            </View>
          ) : (
            <ExploracaoRow exploracao={item} />
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
