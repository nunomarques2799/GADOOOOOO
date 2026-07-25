import { useLocalSearchParams } from 'expo-router';

import { FormularioAnimal } from '@/components/FormularioAnimal';

/**
 * Registar um animal. Aceita `exploracaoId` para vir já com a exploração certa
 * escolhida — é o que faz o atalho "Adicionar" dentro da página da exploração
 * não obrigar a escolhê-la outra vez.
 *
 * O id passa sem ser conferido aqui de propósito: as explorações podem ainda
 * estar a chegar da cache (offline-first), e recusá-lo por a lista estar vazia
 * dava um formulário sem exploração nenhuma. Quem confere é o formulário,
 * quando a lista assentar.
 */
export default function NovoAnimalScreen() {
  const { exploracaoId } = useLocalSearchParams<{ exploracaoId?: string }>();

  return <FormularioAnimal exploracaoInicial={exploracaoId} />;
}
