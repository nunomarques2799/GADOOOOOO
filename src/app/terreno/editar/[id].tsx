import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioTerreno } from '@/components/FormularioTerreno';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors } from '@/theme';

export default function EditarTerrenoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { terrenoById } = useGado();
  const terreno = id ? terrenoById(id) : undefined;

  if (!terreno) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Terreno" />
        <EmptyState icon="map-marker" title="Terreno não encontrado" message="Este registo já não existe." />
      </View>
    );
  }

  return <FormularioTerreno terreno={terreno} exploracaoId={terreno.exploracaoId} />;
}
