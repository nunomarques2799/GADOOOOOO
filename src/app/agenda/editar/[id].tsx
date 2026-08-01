import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioEventoAgenda } from '@/components/FormularioEventoAgenda';
import { EmptyState, Header } from '@/components/ui';
import { useAgenda } from '@/data/useAgenda';
import { colors } from '@/theme';

/** Ver e alterar um evento já marcado. O formulário é o mesmo do "novo". */
export default function EditarEventoAgendaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eventos, aCarregar, guardarEvento, eliminarEvento } = useAgenda();

  const evento = eventos.find((e) => e.id === id);

  if (!evento) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Evento" />
        <EmptyState
          icon="calendar-remove-outline"
          title={aCarregar ? 'A carregar…' : 'Evento não encontrado'}
          message={
            aCarregar
              ? 'A ir buscar o calendário.'
              : 'Este evento já não existe — pode ter sido apagado por quem o marcou.'
          }
        />
      </View>
    );
  }

  return (
    <FormularioEventoAgenda
      evento={evento}
      guardarEvento={guardarEvento}
      eliminarEvento={eliminarEvento}
    />
  );
}
