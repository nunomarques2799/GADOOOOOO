import { useCallback, useState } from 'react';
import { Platform, RefreshControl } from 'react-native';

import { useGado } from '@/data/store';
import { useToasts } from '@/data/toasts';
import { colors } from '@/theme';

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
    }
  }, [recarregar, toast]);

  /**
   * O controlo já feito, para os ecrãs não repetirem as cores da marca.
   *
   * `colors` é lido aqui dentro, a cada render — e não numa constante de módulo
   * — porque a paleta que o criador escolheu só está aplicada depois do arranque
   * (ver DESIGN_SYSTEM.md).
   */
  const controlo = (
    <RefreshControl
      refreshing={aAtualizar}
      onRefresh={() => void atualizar()}
      // Android usa `colors`/`progressBackgroundColor`; iOS usa `tintColor`.
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
      tintColor={colors.primary}
      // Na web o gesto de puxar não existe (e o rato não o faz); o
      // react-native-web ignora este controlo, por isso não se perde nada.
      title={Platform.OS === 'ios' ? 'A atualizar…' : undefined}
      titleColor={colors.textSecondary}
    />
  );

  return { aAtualizar, atualizar, controlo };
}
