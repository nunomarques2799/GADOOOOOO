import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioAnimal } from '@/components/FormularioAnimal';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors } from '@/theme';

export default function EditarAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { animalById } = useGado();
  const animal = id ? animalById(id) : undefined;

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Animal" />
        <EmptyState icon="cow-off" title="Animal não encontrado" message="Este registo já não existe." />
      </View>
    );
  }

  return <FormularioAnimal animal={animal} />;
}
