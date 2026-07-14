import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioTerreno } from '@/components/FormularioTerreno';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors } from '@/theme';

export default function NovoTerrenoScreen() {
  const { exploracaoId } = useLocalSearchParams<{ exploracaoId: string }>();
  const { exploracoes } = useGado();

  const alvo = exploracaoId && exploracoes.some((e) => e.id === exploracaoId)
    ? exploracaoId
    : exploracoes[0]?.id;

  if (!alvo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Novo terreno" />
        <EmptyState
          icon="barn"
          title="Sem explorações"
          message="Crie primeiro uma exploração para poder adicionar terrenos."
        />
      </View>
    );
  }

  return <FormularioTerreno exploracaoId={alvo} />;
}
