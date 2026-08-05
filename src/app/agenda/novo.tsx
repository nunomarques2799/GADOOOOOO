import { useLocalSearchParams } from 'expo-router';

import { FormularioEventoAgenda } from '@/components/FormularioEventoAgenda';
import { useAgenda } from '@/data/useAgenda';

/**
 * Marcar um evento no calendário.
 *
 * Aceita `dia` (`aaaa-mm-dd`) para vir já no dia certo — é o que faz o "Marcar
 * evento neste dia" do modal do calendário não obrigar a escrever a data que a
 * pessoa acabou de escolher com o dedo.
 */
export default function NovoEventoAgendaScreen() {
  const { dia, exploracaoId } = useLocalSearchParams<{ dia?: string; exploracaoId?: string }>();
  const { guardarEvento, eliminarEvento } = useAgenda();

  return (
    <FormularioEventoAgenda
      diaInicial={dia}
      exploracaoInicial={exploracaoId}
      guardarEvento={guardarEvento}
      eliminarEvento={eliminarEvento}
    />
  );
}
