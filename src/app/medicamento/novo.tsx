import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioMedicamento } from '@/components/FormularioMedicamento';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors } from '@/theme';

export default function NovoMedicamentoScreen() {
  const { exploracaoId } = useLocalSearchParams<{ exploracaoId?: string }>();
  const { exploracoes } = useGado();

  const alvo =
    exploracaoId && exploracoes.some((e) => e.id === exploracaoId)
      ? exploracaoId
      : exploracoes[0]?.id;

  if (!alvo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Dar entrada" />
        <EmptyState
          icon="barn"
          title="Sem explorações"
          message="Os medicamentos pertencem a uma exploração. Crie primeiro a sua exploração."
        />
      </View>
    );
  }

  return <FormularioMedicamento exploracaoId={alvo} />;
}
