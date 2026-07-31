import { useLocalSearchParams } from 'expo-router';

import { FormularioMovimento } from '@/components/FormularioMovimento';

/**
 * Registar uma despesa ou receita. O formulário vive em
 * `components/FormularioMovimento` e é o MESMO da edição — ver o cabeçalho
 * dele.
 */
export default function NovoMovimentoScreen() {
  const params = useLocalSearchParams<{
    direcao?: string;
    exploracaoId?: string;
    animalId?: string;
  }>();

  return (
    <FormularioMovimento
      direcaoInicial={params.direcao === 'receita' ? 'receita' : 'despesa'}
      exploracaoIdInicial={params.exploracaoId}
      animalIdInicial={params.animalId}
    />
  );
}
