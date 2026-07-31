import { useEffect, useRef } from 'react';

import { paletaDaConta, seguirPaletaDaConta } from '@/theme/preferencia';

import { useAuth } from './auth';

/**
 * Traz a paleta escolhida noutro aparelho.
 * ------------------------------------------------------------------
 * A escolha de cor era do APARELHO: quem a mudava no telemóvel abria o
 * computador e encontrava a app verde outra vez, e a única saída era voltar a
 * escolher em cada sítio. Agora a escolha viaja na conta (ver
 * `theme/preferencia.ts`) e este gancho é o que a aplica deste lado.
 *
 * Não é o gancho que decide nada: `seguirPaletaDaConta` é que sabe se o valor
 * da conta é novidade ou se foi este aparelho que o pôs lá. Aqui só se liga a
 * sessão ao tema — e uma vez por arranque, porque aplicar a paleta recarrega a
 * app e não vale a pena olhar para o mesmo valor duas vezes.
 *
 * Corre dentro do `AuthProvider` e não toca em dados da exploração: numa app
 * offline-first, a cor não pode ficar à espera da sincronização.
 */
export function usePaletaDaConta(): void {
  const { sessao } = useAuth();
  const jaOlhou = useRef(false);

  useEffect(() => {
    if (jaOlhou.current) return;
    const escolha = paletaDaConta(sessao?.user?.user_metadata);
    if (!escolha) return;
    jaOlhou.current = true;
    void seguirPaletaDaConta(escolha);
  }, [sessao]);
}
