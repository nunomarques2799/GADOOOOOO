import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioTerreno } from '@/components/FormularioTerreno';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { colors } from '@/theme';

export default function EditarTerrenoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { terrenoById } = useGado();
  const terreno = id ? terrenoById(id) : undefined;

  if (!terreno) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('formTerreno.terreno')} />
        <EmptyState icon="map-marker" title={t('formTerreno.naoEncontrado')} message={t('ficha.jaNaoExiste')} />
      </View>
    );
  }

  return <FormularioTerreno terreno={terreno} exploracaoId={terreno.exploracaoId} />;
}
