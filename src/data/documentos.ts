/**
 * Documentos guardados na exploração — lógica pura, sem React e sem rede.
 * ------------------------------------------------------------------
 * O papel que se recebe: a fatura da ração, a guia de circulação, o recibo do
 * veterinário. Cada um vai para uma gaveta (a categoria) e fica guardado na
 * exploração, não no telemóvel de quem o fotografou.
 *
 * O ficheiro em si vive no Supabase Storage; aqui e na tabela `documento` fica
 * só o que ele é e onde está — ver `supabase/schema_documentos.sql` para o
 * porquê de não ser uma coluna, como acontece com a foto do animal.
 */

import type { IconName } from '@/components/ui';

/**
 * As gavetas. São poucas de propósito: uma lista de vinte categorias faz com
 * que tudo acabe em "Outros", porque escolher passa a dar mais trabalho do que
 * guardar.
 *
 * Os valores estão escritos por extenso e são os mesmos que a restrição
 * `documento_categoria_conhecida` aceita no servidor. Ao acrescentar uma,
 * mexe-se nos dois sítios.
 */
export const CATEGORIAS_DOCUMENTO = [
  'Financeiro',
  'Sanidade',
  'Documentos pessoais',
  'Outros',
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

/** A gaveta em que um documento cai quando ninguém escolhe. */
export const CATEGORIA_OMISSAO: CategoriaDocumento = 'Outros';

export type Documento = {
  id: string;
  exploracaoId: string;
  /** Quem o guardou. Pode faltar se a conta dessa pessoa já não existir. */
  criadoPor?: string;
  titulo: string;
  categoria: CategoriaDocumento;
  /** Onde o ficheiro está no bucket: `<exploracao_id>/<id>.jpg`. */
  caminho: string;
  /** Bytes. */
  tamanho?: number;
  criadoEm: string;
};

/** O ícone de cada gaveta, para se distinguirem de relance na lista. */
export function iconeCategoria(c: CategoriaDocumento): IconName {
  switch (c) {
    case 'Financeiro':
      return 'receipt';
    case 'Sanidade':
      return 'medical-bag';
    case 'Documentos pessoais':
      return 'card-account-details-outline';
    case 'Outros':
      return 'file-document-outline';
  }
}

/** O que cabe em cada gaveta, em linguagem de quem trata do gado. */
export function explicacaoCategoria(c: CategoriaDocumento): string {
  switch (c) {
    case 'Financeiro':
      return 'Faturas, recibos, talões — o que se paga e o que se recebe.';
    case 'Sanidade':
      return 'Guias de circulação, atestados, receitas do veterinário.';
    case 'Documentos pessoais':
      return 'Cartões, licenças, contratos — o que é seu e não da exploração.';
    case 'Outros':
      return 'Tudo o que não cabe nas anteriores.';
  }
}

/**
 * Um valor vindo da rede (ou da cache, que é um ficheiro editável à mão) como
 * uma categoria que conhecemos. O desconhecido vai para "Outros" em vez de
 * partir o ecrã — a alternativa era um documento invisível por causa de uma
 * palavra que ninguém escreveu à mão.
 */
export function categoriaValida(bruto: unknown): CategoriaDocumento {
  return CATEGORIAS_DOCUMENTO.includes(bruto as CategoriaDocumento)
    ? (bruto as CategoriaDocumento)
    : CATEGORIA_OMISSAO;
}

/**
 * O teto por ficheiro, em bytes. Igual ao `file_size_limit` do bucket — se
 * divergirem, o Storage recusa o que esta app deixou passar, e a recusa chega
 * em inglês e no fim do carregamento.
 */
export const TAMANHO_MAX = 10 * 1024 * 1024;

/**
 * O que impede este documento de ser guardado, em palavras — ou `null`.
 *
 * Uma frase por engano: "falta o nome" e "o ficheiro é grande de mais" pedem
 * coisas diferentes de quem está a carregar.
 */
export function problemaComDocumento(titulo: string, tamanho: number): string | null {
  if (!titulo.trim()) return 'Dê um nome ao documento — "Fatura da ração de julho", por exemplo.';
  if (titulo.trim().length > 120) return 'O nome é demasiado comprido.';
  if (tamanho <= 0) return 'O ficheiro está vazio.';
  if (tamanho > TAMANHO_MAX) {
    return 'A imagem é grande de mais. Fotografe outra vez com menos qualidade.';
  }
  return null;
}

/** "480 KB", "1,2 MB" — o tamanho como se lê. */
export function tamanhoLegivel(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  // Vírgula decimal: é assim que se escreve em português.
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

/**
 * O caminho do ficheiro dentro do bucket.
 *
 * A exploração VEM À FRENTE porque é a primeira pasta do caminho que as
 * políticas do Storage leem para saber a quem o ficheiro pertence (ver
 * `storage.foldername(name)` no schema). Trocar a ordem aqui abria os ficheiros
 * de toda a gente sem nada no SQL a mudar de cor.
 */
export function caminhoDocumento(
  exploracaoId: string,
  documentoId: string,
  extensao: string,
): string {
  return `${exploracaoId}/${documentoId}.${extensao}`;
}

/** Os documentos de uma categoria — `undefined` devolve todos. */
export function filtrarPorCategoria(
  documentos: Documento[],
  categoria?: CategoriaDocumento,
): Documento[] {
  return categoria ? documentos.filter((d) => d.categoria === categoria) : documentos;
}

/** Quantos documentos há em cada gaveta, para os números dos filtros. */
export function contarPorCategoria(
  documentos: Documento[],
): Record<CategoriaDocumento, number> {
  const conta = {
    'Financeiro': 0,
    'Sanidade': 0,
    'Documentos pessoais': 0,
    'Outros': 0,
  } as Record<CategoriaDocumento, number>;
  for (const d of documentos) conta[d.categoria]++;
  return conta;
}
