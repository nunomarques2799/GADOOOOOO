import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioTerreno } from '@/components/FormularioTerreno';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
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
        <Header title={t('terrenos.novo')} />
        <EmptyState
          icon="barn"
          title={t('formTerreno.semExploracoesTitulo')}
          message={t('formTerreno.semExploracoesMensagem')}
        />
      </View>
    );
  }

  return <FormularioTerreno exploracaoId={alvo} />;
}
