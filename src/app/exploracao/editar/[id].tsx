import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioExploracao } from '@/components/FormularioExploracao';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors } from '@/theme';

export default function EditarExploracaoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exploracaoById } = useGado();
  const exploracao = id ? exploracaoById(id) : undefined;

  if (!exploracao) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Exploração" />
        <EmptyState icon="barn" title="Exploração não encontrada" message="Este registo já não existe." />
      </View>
    );
  }

  return <FormularioExploracao exploracao={exploracao} />;
}
