import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioAnimal } from '@/components/FormularioAnimal';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { colors } from '@/theme';

export default function EditarAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { animalById } = useGado();
  const animal = id ? animalById(id) : undefined;

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('ficha.animal')} />
        <EmptyState icon="cow-off" title={t('genealogia.naoEncontrado')} message={t('ficha.jaNaoExiste')} />
      </View>
    );
  }

  return <FormularioAnimal animal={animal} />;
}
