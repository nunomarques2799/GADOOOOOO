import { useCallback, useState } from 'react';

import { DURACAO, semMovimento } from './movimento';

/**
 * O visto do Guardar.
 *
 * Um formulário que grava e fecha no mesmo instante deixa quem está a usar a
 * app sem saber se gravou: o ecrã simplesmente muda. Com isto, o botão mostra
 * um visto, espera-se meio segundo, e só então o formulário fecha e aparece o
 * aviso. Quem chama liga o \`concluido\` ao \`<Button>\` e faz
 * \`await visto.mostrar()\` entre gravar e fechar.
 *
 * Só depois de gravar COM SUCESSO: uma recusa do servidor não mostra visto
 * nenhum. E sem movimento (Reduzir movimento, testes) não se espera nada.
 */
export function useVisto() {
  const [concluido, setConcluido] = useState(false);

  const mostrar = useCallback(async () => {
    if (semMovimento()) return;
    setConcluido(true);
    await new Promise((r) => setTimeout(r, DURACAO.visto));
  }, []);

  return { concluido, mostrar };
}
