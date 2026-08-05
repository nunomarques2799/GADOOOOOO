import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioMedicamento } from '@/components/FormularioMedicamento';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors } from '@/theme';

export default function EditarMedicamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { medicamentoById } = useGado();
  const medicamento = medicamentoById(id);

  if (!medicamento) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Lote" />
        <EmptyState
          icon="package-variant-closed"
          title="Lote não encontrado"
          message="Este lote pode ter sido eliminado noutro aparelho."
        />
      </View>
    );
  }

  return (
    <FormularioMedicamento
      medicamento={medicamento}
      exploracaoId={medicamento.exploracaoId}
    />
  );
}
