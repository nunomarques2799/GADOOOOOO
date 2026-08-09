import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioExploracao } from '@/components/FormularioExploracao';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { colors } from '@/theme';

export default function EditarExploracaoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exploracaoById } = useGado();
  const exploracao = id ? exploracaoById(id) : undefined;

  if (!exploracao) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('formAnimal.exploracao')} />
        <EmptyState icon="barn" title={t('formExploracao.naoEncontrada')} message={t('ficha.jaNaoExiste')} />
      </View>
    );
  }

  return <FormularioExploracao exploracao={exploracao} />;
}
