import { useEffect, useMemo } from 'react';

import { useMembros } from '@/data/membros';
import { useNotificacoes } from '@/data/notificacoes';
import {
  agendar as agendarNotificacoes,
  cancelarTudo as cancelarNotificacoes,
  suportaNotificacoes,
} from '@/data/notificacoesLocais';
import type { AcessoComPrazo } from '@/data/notificacoesPlano';
import { useGado } from '@/data/store';

/**
 * Quem manda os avisos para o telemóvel. Não desenha nada.
 * ------------------------------------------------------------------
 * Isto vivia dentro do `store.tsx`, e teve de sair de lá quando os avisos
 * passaram a incluir o FIM DO ACESSO: esse dado vem do `useMembros()`, e o
 * `membros.tsx` chega ao `store.tsx` por um caminho indireto
 * (`membros` → `nomesEquipa` → `store`). Importar `membros` no `store` fechava
 * o ciclo.
 *
 * Aqui não há ciclo nenhum: este componente importa os três contextos e nenhum
 * deles o importa a ele. Fica montado dentro do `GadoProvider`, que já está
 * dentro do `NotificacoesProvider` e do `MembrosProvider`.
 *
 * Há UM só agendador de propósito. O `agendar()` começa por cancelar tudo o que
 * está pendente, portanto dois destes a correr apagavam o trabalho um do outro:
 * o segundo cancelava os avisos que o primeiro tinha acabado de pôr.
 */
export function AgendadorAvisos() {
  const { alertas, exploracoes } = useGado();
  const { preferencias: prefs } = useNotificacoes();
  const { membros } = useMembros();

  /**
   * Os vínculos com prazo, com o nome da exploração à frente.
   *
   * `membros` são os do PRÓPRIO — é a sessão de quem está no aparelho. É por
   * isso que o aviso chega ao telemóvel certo sem nada o encaminhar: quem tem o
   * prazo é quem o vê a aproximar-se.
   *
   * A chave do `useMemo` é escrita como TEXTO e não como a lista: `membros` é um
   * array novo a cada render do contexto, e um efeito que dependesse dele
   * reagendava dezenas de notificações a cada re-render.
   */
  const chave = useMemo(
    () => membros.map((m) => `${m.id}:${m.expiraEm ?? ''}`).join('|'),
    [membros],
  );

  const acessos = useMemo<AcessoComPrazo[]>(
    () =>
      membros
        .filter((m) => m.expiraEm)
        .map((m) => ({
          membroId: m.id,
          nomeExploracao:
            exploracoes.find((e) => e.id === m.exploracaoId)?.nome ?? 'uma exploração',
          expiraEm: m.expiraEm,
        })),
    // `chave` decide quando vale a pena refazer isto; o `exploracoes` entra
    // para o nome acompanhar uma exploração que mude de nome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave, exploracoes],
  );

  /**
   * Reagenda sempre que os alertas ou os prazos mudam. O atraso evita repetir o
   * trabalho durante uma sincronização, que atualiza os dados várias vezes
   * seguidas — cancelar e reagendar dezenas de notificações a cada passo seria
   * trabalho deitado fora.
   */
  useEffect(() => {
    if (!suportaNotificacoes) return;
    const t = setTimeout(() => {
      if (prefs.noTelemovel) void agendarNotificacoes(alertas, prefs, acessos);
      else void cancelarNotificacoes();
    }, 2000);
    return () => clearTimeout(t);
  }, [alertas, prefs, acessos]);

  return null;
}
