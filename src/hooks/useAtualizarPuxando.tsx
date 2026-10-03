import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { acabarAtualizar, comecarAtualizar } from '@/components/IndicadorAtualizar';
import { useGado } from '@/data/store';
import { useToasts } from '@/data/toasts';

/**
 * Puxar a lista para baixo para ir buscar o que há de novo.
 * ------------------------------------------------------------------
 * A app já sincronizava sozinha em três momentos — ao arrancar, ao voltar ao
 * primeiro plano e quando a rede volta (ver `store.tsx`). Faltava o quarto, que
 * é o único que a pessoa controla: "eu sei que o meu filho acabou de registar a
 * vacina, quero vê-la agora". Sem isto, a única forma era fechar a app e abrir
 * outra vez.
 *
 * O resultado é dito em voz alta quando corre mal. Um gesto que não muda nada no
 * ecrã e não explica porquê é pior do que não haver gesto nenhum: fica-se a
 * pensar que a app está estragada, quando o que falta é rede.
 */
export function useAtualizarPuxando() {
  const { recarregar } = useGado();
  const toast = useToasts();
  const [aAtualizar, setAAtualizar] = useState(false);

  const atualizar = useCallback(async () => {
    setAAtualizar(true);
    // O logótipo com o arco dourado, no topo do ecrã (ver `IndicadorAtualizar`).
    comecarAtualizar();
    try {
      const leu = await recarregar();
      if (!leu) {
        toast.info(
          'Sem ligação ao servidor',
          'Continua a ver os dados guardados no aparelho. Volta a tentar sozinho quando houver rede.',
        );
      }
    } finally {
      // No `finally`: uma falha inesperada não pode deixar a roda a girar para
      // sempre no topo da lista.
      setAAtualizar(false);
      acabarAtualizar();
    }
  }, [recarregar, toast]);

  /**
   * O controlo já feito, para os oito ecrãs com o gesto.
   *
   * A roda do sistema fica INVISÍVEL: quem mostra que se está a atualizar é o
   * logótipo com o arco dourado (`IndicadorAtualizar`, na raiz). O controlo
   * continua cá porque é ele que faz o gesto de puxar e abre o espaço no topo.
   */
  const controlo = (
    <RefreshControl
      refreshing={aAtualizar}
      onRefresh={() => void atualizar()}
      // Android usa `colors`/`progressBackgroundColor`; iOS usa `tintColor`.
      colors={['transparent']}
      progressBackgroundColor="transparent"
      tintColor="transparent"
      // Na web o gesto de puxar não existe (e o rato não o faz); o
      // react-native-web ignora este controlo, por isso não se perde nada.
    />
  );

  return { aAtualizar, atualizar, controlo };
}
