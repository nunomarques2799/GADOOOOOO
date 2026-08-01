/**
 * Os documentos ligados ao servidor — listar, carregar, abrir e apagar.
 * ------------------------------------------------------------------
 * As gavetas e as validações vivem no `documentos.ts` (lógica pura, testada);
 * aqui fica o que precisa de React, de rede e do Storage.
 *
 * DUAS ESCRITAS QUE NÃO SÃO UMA TRANSAÇÃO. Guardar um documento é subir o
 * ficheiro ao bucket E gravar a linha na tabela, e o Postgres não sabe desfazer
 * a primeira se a segunda falhar. A ordem é essa — ficheiro primeiro, linha
 * depois — e é escolhida pelo que sobra quando parte a meio:
 *
 *   ficheiro sem linha  → um objeto no bucket que a app ignora. Invisível,
 *                         recuperável, e nós apagamo-lo já a seguir.
 *   linha sem ficheiro  → um documento na lista que não abre. Fica lá para
 *                         sempre a dizer que existe uma fatura que não existe.
 *
 * O primeiro é lixo; o segundo é uma mentira. Daí a ordem.
 *
 * OFFLINE. Como as notas e a agenda, a escrita é pessimista: sem rede não sobe
 * um ficheiro para lado nenhum, e dizê-lo na hora é melhor do que uma fila de
 * sincronização a segurar imagens de vários MB. A LEITURA da lista continua a
 * funcionar da cache; abrir um documento é que exige ligação.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { armazenamentoDisponivel, guardar, ler } from './armazenamento';
import { useAuth } from './auth';
import {
  caminhoDocumento,
  categoriaValida,
  type CategoriaDocumento,
  type Documento,
} from './documentos';
import type { FicheiroEscolhido } from './ficheiroDocumento';
import { supabase, supabaseConfigurado } from './supabase';

const CHAVE_CACHE = 'gado.documentos.v1';
const BUCKET = 'documentos';

/**
 * Quanto tempo a ligação a um documento vale. Uma hora chega para o ver e para
 * o guardar no computador, e é curta que baste para um URL que escape numa
 * partilha não servir de porta aberta.
 */
const SEGUNDOS_LIGACAO = 3600;

function novoId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---- Cache local (espelho da LISTA; os ficheiros nunca lá entram) ---- */

function lerCache(): Documento[] {
  const bruto = ler(CHAVE_CACHE);
  if (!bruto) return [];
  try {
    const arr = JSON.parse(bruto) as Documento[];
    return Array.isArray(arr) ? arr.map((d) => ({ ...d, categoria: categoriaValida(d.categoria) })) : [];
  } catch {
    return [];
  }
}

function guardarCache(docs: Documento[]): void {
  if (armazenamentoDisponivel) guardar(CHAVE_CACHE, JSON.stringify(docs));
}

/* ---- Repositório ---- */

type LinhaDocumento = {
  id: string;
  exploracao_id: string;
  criado_por?: string | null;
  titulo: string;
  categoria?: string | null;
  caminho: string;
  tamanho?: number | null;
  criado_em?: string | null;
};

function toDocumento(r: LinhaDocumento): Documento {
  return {
    id: r.id,
    exploracaoId: r.exploracao_id,
    criadoPor: r.criado_por ?? undefined,
    titulo: r.titulo,
    categoria: categoriaValida(r.categoria),
    caminho: r.caminho,
    tamanho: r.tamanho ?? undefined,
    criadoEm: r.criado_em ?? new Date().toISOString(),
  };
}

const COLUNAS = 'id, exploracao_id, criado_por, titulo, categoria, caminho, tamanho, criado_em';

export type EntradaDocumento = {
  exploracaoId: string;
  titulo: string;
  categoria: CategoriaDocumento;
  ficheiro: FicheiroEscolhido;
};

export type UseDocumentos = {
  documentos: Documento[];
  aCarregar: boolean;
  erro: string | null;
  /** Sobe o ficheiro e grava a linha. Devolve o documento guardado. */
  carregarDocumento: (entrada: EntradaDocumento) => Promise<Documento>;
  /** Muda o nome ou a gaveta de um documento já guardado. */
  atualizarDocumento: (
    id: string,
    campos: { titulo?: string; categoria?: CategoriaDocumento },
  ) => Promise<void>;
  /** Apaga a linha E o ficheiro. */
  eliminarDocumento: (id: string) => Promise<void>;
  /** Uma ligação temporária para abrir ou descarregar o ficheiro. */
  ligacaoPara: (documento: Documento) => Promise<string>;
  recarregar: () => Promise<void>;
};

export function useDocumentos(): UseDocumentos {
  const { sessao } = useAuth();
  const usaSupabase = supabaseConfigurado && !!sessao;
  const userId = sessao?.user?.id ?? '';

  const [documentos, setDocumentos] = useState<Documento[]>(() =>
    armazenamentoDisponivel ? lerCache() : [],
  );
  const [aCarregar, setACarregar] = useState<boolean>(usaSupabase);
  const [erro, setErro] = useState<string | null>(null);

  const puxar = useCallback(async () => {
    if (!usaSupabase || !supabase) {
      setACarregar(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('documento')
        .select(COLUNAS)
        .order('criado_em', { ascending: false });
      if (error) throw new Error(error.message);
      const lista = ((data ?? []) as LinhaDocumento[]).map(toDocumento);
      setDocumentos(lista);
      guardarCache(lista);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACarregar(false);
    }
  }, [usaSupabase]);

  useEffect(() => {
    void puxar();
  }, [puxar]);

  const carregarDocumento = useCallback(
    async (entrada: EntradaDocumento): Promise<Documento> => {
      if (!usaSupabase || !supabase) {
        throw new Error(
          'Guardar documentos precisa de ligação à conta. A app está em modo local.',
        );
      }
      const id = novoId();
      const caminho = caminhoDocumento(entrada.exploracaoId, id, entrada.ficheiro.extensao);

      // 1. O ficheiro. Ver o cabeçalho para o porquê de ser este o primeiro.
      const { error: erroFicheiro } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, entrada.ficheiro.bytes, {
          contentType: entrada.ficheiro.mime,
          upsert: false,
        });
      if (erroFicheiro) throw new Error(erroFicheiro.message);

      const documento: Documento = {
        id,
        exploracaoId: entrada.exploracaoId,
        criadoPor: userId,
        titulo: entrada.titulo.trim(),
        categoria: entrada.categoria,
        caminho,
        tamanho: entrada.ficheiro.tamanho,
        criadoEm: new Date().toISOString(),
      };

      // 2. A linha. Falhando esta, o ficheiro que acabou de subir fica órfão no
      // bucket — apaga-se já, para o teto de espaço do plano não ir sendo comido
      // por tentativas falhadas que ninguém vê em lado nenhum.
      const { error: erroLinha } = await supabase.from('documento').insert({
        id: documento.id,
        exploracao_id: documento.exploracaoId,
        criado_por: documento.criadoPor,
        titulo: documento.titulo,
        categoria: documento.categoria,
        caminho: documento.caminho,
        tamanho: documento.tamanho,
      });
      if (erroLinha) {
        // Em `try/catch` porque esta limpeza não pode roubar o erro à causa: o
        // que interessa a quem está no ecrã é a razão pela qual não gravou, e
        // não o que correu mal a arrumar a seguir.
        try {
          await supabase.storage.from(BUCKET).remove([caminho]);
        } catch {
          /* fica órfão; o erro que conta é o de baixo */
        }
        throw new Error(erroLinha.message);
      }

      setDocumentos((prev) => {
        const novos = [documento, ...prev];
        guardarCache(novos);
        return novos;
      });
      return documento;
    },
    [usaSupabase, userId],
  );

  const atualizarDocumento = useCallback(
    async (
      id: string,
      campos: { titulo?: string; categoria?: CategoriaDocumento },
    ): Promise<void> => {
      if (usaSupabase && supabase) {
        const { error } = await supabase
          .from('documento')
          .update({
            ...(campos.titulo !== undefined ? { titulo: campos.titulo.trim() } : {}),
            ...(campos.categoria !== undefined ? { categoria: campos.categoria } : {}),
          })
          .eq('id', id);
        if (error) throw new Error(error.message);
      }
      setDocumentos((prev) => {
        const novos = prev.map((d) =>
          d.id === id
            ? {
                ...d,
                titulo: campos.titulo?.trim() ?? d.titulo,
                categoria: campos.categoria ?? d.categoria,
              }
            : d,
        );
        guardarCache(novos);
        return novos;
      });
    },
    [usaSupabase],
  );

  const eliminarDocumento = useCallback(
    async (id: string): Promise<void> => {
      const doc = documentos.find((d) => d.id === id);
      if (usaSupabase && supabase) {
        // A LINHA primeiro, ao contrário do carregamento — e pela mesma razão.
        // Apagado o ficheiro e falhando a linha, ficava na lista um documento
        // que já não abre; assim, o pior que acontece é um ficheiro órfão que
        // ninguém vê.
        const { error } = await supabase.from('documento').delete().eq('id', id);
        if (error) throw new Error(error.message);
        if (doc) {
          try {
            await supabase.storage.from(BUCKET).remove([doc.caminho]);
          } catch {
            /* a linha já foi; o ficheiro órfão não estraga o ecrã de ninguém */
          }
        }
      }
      setDocumentos((prev) => {
        const novos = prev.filter((d) => d.id !== id);
        guardarCache(novos);
        return novos;
      });
    },
    [documentos, usaSupabase],
  );

  const ligacaoPara = useCallback(async (documento: Documento): Promise<string> => {
    if (!supabase) throw new Error('Abrir documentos precisa de ligação à conta.');
    // Assinada e de prazo curto: o bucket é privado, portanto não há URL fixo
    // que sirva o ficheiro — e é isso que impede uma fatura de ficar acessível
    // a quem apanhar o endereço.
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(documento.caminho, SEGUNDOS_LIGACAO);
    if (error) throw new Error(error.message);
    if (!data?.signedUrl) throw new Error('O servidor não devolveu a ligação ao ficheiro.');
    return data.signedUrl;
  }, []);

  return useMemo(
    () => ({
      documentos,
      aCarregar,
      erro,
      carregarDocumento,
      atualizarDocumento,
      eliminarDocumento,
      ligacaoPara,
      recarregar: puxar,
    }),
    [
      documentos,
      aCarregar,
      erro,
      carregarDocumento,
      atualizarDocumento,
      eliminarDocumento,
      ligacaoPara,
      puxar,
    ],
  );
}
