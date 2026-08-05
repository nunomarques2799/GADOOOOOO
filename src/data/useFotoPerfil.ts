/**
 * A fotografia da própria conta.
 * ------------------------------------------------------------------
 * Data URI JPEG reduzido, guardado na coluna `perfil.fotografia` — a mesma via
 * da foto do animal e do terreno (`data/foto.ts`), e NÃO o Supabase Storage que
 * os documentos usam.
 *
 * A diferença que decide: um documento é um de muitos e vão-se acumulando; isto
 * é UMA por conta e fica sempre do mesmo tamanho. Não há aqui nada que cresça,
 * portanto não se paga o preço do bucket — pedir uma ligação assinada de cada
 * vez que se desenha o avatar seria um pedido de rede para mostrar a cara de
 * quem já está com sessão aberta.
 *
 * A escrita é PESSIMISTA (como as notas e a agenda): grava no servidor e só
 * depois no ecrã. A LEITURA vem da cache, para o avatar aparecer no arranque
 * sem esperar pela rede.
 *
 * QUEM A VÊ: só o próprio. A RLS de `perfil` (`perfil_self_select`) deixa cada
 * um ler a SUA linha, e a lista de Trabalhadores tira os nomes do
 * `nomes_da_equipa()`, que não devolve a coluna. Mostrar as fotos à equipa é
 * uma decisão à parte — ver a nota em `supabase/schema_equipa_e_foto.sql`.
 */

import { useCallback, useEffect, useState } from 'react';

import { armazenamentoDisponivel, guardar, ler } from './armazenamento';
import { useAuth } from './auth';
import { supabase, supabaseConfigurado } from './supabase';

const CHAVE_CACHE = 'gado.fotoPerfil.v1';

export type UseFotoPerfil = {
  /** O data URI, ou `undefined` se não houver foto. */
  foto?: string;
  aCarregar: boolean;
  /** Grava (ou remove, com `undefined`). Lança com a razão se o servidor recusar. */
  definirFoto: (dataUri: string | undefined) => Promise<void>;
};

export function useFotoPerfil(): UseFotoPerfil {
  const { sessao } = useAuth();
  const usaSupabase = supabaseConfigurado && !!sessao;
  const userId = sessao?.user?.id ?? '';

  const [foto, setFoto] = useState<string | undefined>(() =>
    armazenamentoDisponivel ? (ler(CHAVE_CACHE) ?? undefined) : undefined,
  );
  const [aCarregar, setACarregar] = useState<boolean>(usaSupabase);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      if (!usaSupabase || !supabase || !userId) {
        setACarregar(false);
        return;
      }
      const { data, error } = await supabase
        .from('perfil')
        .select('fotografia')
        .eq('id', userId)
        .maybeSingle();
      if (!vivo) return;
      // Sem rede fica a da cache: um avatar em branco durante a falha era pior
      // do que o de ontem, que é o mesmo de hoje.
      if (!error) {
        const nova = (data as { fotografia?: string | null } | null)?.fotografia ?? undefined;
        setFoto(nova);
        if (armazenamentoDisponivel) guardar(CHAVE_CACHE, nova ?? '');
      }
      setACarregar(false);
    })();
    return () => {
      vivo = false;
    };
  }, [usaSupabase, userId]);

  const definirFoto = useCallback(
    async (dataUri: string | undefined): Promise<void> => {
      if (usaSupabase && supabase && userId) {
        // `update` e não `upsert`: a linha do perfil nasce com a conta (o
        // trigger do registo cria-a). Um upsert aqui podia inserir uma linha
        // paralela se o id viesse errado, e a RLS recusava-a com um erro que
        // não diz nada a quem só queria escolher uma fotografia.
        const { error } = await supabase
          .from('perfil')
          .update({ fotografia: dataUri ?? null })
          .eq('id', userId);
        if (error) throw new Error(error.message);
      }
      setFoto(dataUri);
      if (armazenamentoDisponivel) guardar(CHAVE_CACHE, dataUri ?? '');
    },
    [usaSupabase, userId],
  );

  return { foto, aCarregar, definirFoto };
}
