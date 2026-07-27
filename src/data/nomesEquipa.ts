/**
 * Id de utilizador → nome de quem trabalha nas minhas explorações.
 * ------------------------------------------------------------------
 * Existe por causa dos ecrãs de auditoria: "eliminado por" e "registado por"
 * são inúteis se mostrarem um UUID. O nome não vem com os dados normais porque
 * a RLS de `perfil` só deixa cada um ver o seu (ver `nomes_da_equipa()` em
 * `supabase/schema_auditoria.sql`, que é o único caminho aberto).
 *
 * A lista é pequena (as pessoas de uma exploração contam-se pelos dedos) e
 * quase nunca muda, por isso pede-se UMA vez por arranque e guarda-se num
 * módulo. Sem isso, cada linha de cada histórico faria o seu próprio pedido.
 */

import { useEffect, useState } from 'react';

import { useGado } from './store';
import { supabaseConfigurado } from './supabase';
import { nomesDaEquipaSupabase } from './supabaseRepo';

type Nomes = Record<string, string>;

let cache: Nomes | null = null;
/** O pedido em curso, para dez ecrãs ao mesmo tempo não darem dez pedidos. */
let aPedir: Promise<Nomes> | null = null;

/** Os nomes, do cache ou do servidor. Nunca lança: sem nomes, fica vazio. */
export async function carregarNomesEquipa(): Promise<Nomes> {
  if (cache) return cache;
  if (!supabaseConfigurado) return {};
  if (!aPedir) {
    aPedir = nomesDaEquipaSupabase()
      .then((n) => {
        cache = n;
        return n;
      })
      .catch(() => ({}))
      .finally(() => {
        aPedir = null;
      });
  }
  return aPedir;
}

/** Esquece o que sabe. Chamar ao trocar de conta ou ao mudar a equipa. */
export function esquecerNomesEquipa(): void {
  cache = null;
}

/**
 * `nomeDe(id)` para a interface.
 *
 * Devolve `undefined` enquanto não souber, e não um texto de espera: quem
 * chama decide o que pôr no lugar (nem sempre é a mesma coisa, e "a carregar…"
 * congelado num ecrã que nunca recebe resposta é pior do que nada).
 */
export function useNomesEquipa(): {
  nomeDe: (id?: string) => string | undefined;
  aCarregar: boolean;
} {
  const { utilizador } = useGado();
  const [nomes, setNomes] = useState<Nomes>(() => cache ?? {});
  const [aCarregar, setACarregar] = useState(!cache && supabaseConfigurado);

  useEffect(() => {
    if (cache) return;
    let vivo = true;
    void carregarNomesEquipa().then((n) => {
      if (!vivo) return;
      setNomes(n);
      setACarregar(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return {
    nomeDe: (id?: string) => {
      if (!id) return undefined;
      // O próprio nome não vem da rede. Sem isto, quem trabalha sozinho (ou
      // está em modo local, sem servidor a quem perguntar) via "sem registo de
      // autor" nas linhas que acabou de escrever — a auditoria a não reconhecer
      // a única pessoa que ela conhece de certeza.
      if (id === utilizador.id) return utilizador.nome;
      return nomes[id];
    },
    aCarregar,
  };
}
