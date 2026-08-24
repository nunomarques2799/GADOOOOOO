/**
 * A fila de moderação: ler, agir, e ver o ficheiro denunciado.
 * ------------------------------------------------------------------
 * O que precisa de rede. As contas e os formatos estão no `denuncias.ts`.
 *
 * PORQUE É QUE ISTO NÃO SÃO RPCs, AO CONTRÁRIO DO RESTO DO PAINEL
 *
 * O `superadminApi.ts` fala por RPCs `security definer` porque o que ele quer
 * está em `auth.users`, que nenhuma política alcança. Aqui não é preciso: a
 * `mensagem_denuncia` tem políticas próprias (`denuncia_superadmin_select` e
 * `denuncia_superadmin_update`, no `schema_chat.sql`) e é a RLS que decide.
 * Uma RPC nova só acrescentaria um ficheiro de schema a aplicar em produção
 * para fazer o que a base já deixa fazer.
 *
 * A consequência é boa: quem não é superadmin não lê nem escreve NADA aqui,
 * e isso prova-se no psql (`supabase/provar_denuncias.sql`) em vez de depender
 * de um `if` no topo de uma função.
 *
 * O QUE FICA DE FORA, DE PROPÓSITO
 *
 * O email. Ele vive em `auth.users` e chega ao painel pelo
 * `superadmin_listar_clientes()`, que só devolve CLIENTES (donos de
 * exploração). Quem é denunciado é muitas vezes um trabalhador, e para esse a
 * RPC não devolve linha nenhuma. Em vez de abrir uma porta nova a `auth.users`
 * por causa de um campo, mostra-se o que o `perfil` dá (nome e telefone), que
 * é com o que se telefona a alguém.
 */

import {
  lerContexto,
  lerTipo,
  type Denuncia,
  type EstadoDenuncia,
  type PessoaDenunciada,
} from './denuncias';
import { supabase } from './supabase';

/** O bucket dos anexos das conversas. O mesmo do `useChat.ts`. */
const BUCKET = 'chat';

/** Quanto tempo dura a ligação a um ficheiro denunciado. */
const SEGUNDOS_LIGACAO = 300;

/**
 * Numa linha só, e não partida em duas com um `+`: o supabase-js lê a lista de
 * colunas como TIPO literal para saber o que devolve, e uma concatenação em
 * tempo de execução deixa-o com `string`. O resultado passava a ser um
 * `GenericStringError[]` e o `tsc` recusava a conversão.
 */
const COLUNAS =
  'id, mensagem_id, conversa_id, denunciado_por, autor_denunciado, texto_copia, tipo, anexo, contexto, motivo, criado_em, estado, tratado_em, nota_superadmin';

type LinhaDenuncia = {
  id: string;
  mensagem_id: string | null;
  conversa_id: string | null;
  denunciado_por: string | null;
  autor_denunciado: string | null;
  texto_copia: string | null;
  tipo: string | null;
  anexo: string | null;
  contexto: unknown;
  motivo: string | null;
  criado_em: string;
  estado: EstadoDenuncia;
  tratado_em: string | null;
  nota_superadmin: string | null;
};

function toDenuncia(r: LinhaDenuncia): Denuncia {
  return {
    id: r.id,
    mensagemId: r.mensagem_id ?? undefined,
    conversaId: r.conversa_id ?? undefined,
    denunciadoPor: r.denunciado_por ?? undefined,
    autorDenunciado: r.autor_denunciado ?? undefined,
    textoCopia: r.texto_copia ?? '',
    tipo: lerTipo(r.tipo),
    anexo: r.anexo ?? undefined,
    contexto: lerContexto(r.contexto),
    motivo: r.motivo ?? undefined,
    criadoEm: r.criado_em,
    estado: r.estado,
    tratadoEm: r.tratado_em ?? undefined,
    notaSuperadmin: r.nota_superadmin ?? undefined,
  };
}

/**
 * A fila inteira, das mais recentes para as mais antigas.
 *
 * Sem paginação e sem teto por agora: a fila de uma plataforma com um punhado
 * de contas cabe num ecrã, e um teto silencioso escondia denúncias antigas por
 * tratar. Se um dia crescer, é aqui que entra o `range()`.
 */
export async function listarDenuncias(): Promise<Denuncia[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('mensagem_denuncia')
    .select(COLUNAS)
    .order('criado_em', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as LinhaDenuncia[]).map(toDenuncia);
}

/**
 * Quem são as contas envolvidas.
 *
 * A `perfil` é lida diretamente porque a política `perfil_self_select` já abre
 * a tabela ao superadmin (`schema_roles.sql`). Um id sem linha é um perfil que
 * nunca chegou a existir, e o ecrã trata-o como "sem nome".
 *
 * Nome e telefone vêm na MESMA leitura: são a mesma linha da mesma tabela, e
 * duas chamadas seguidas seriam duas idas para a mesma resposta.
 */
export async function pessoasDasDenuncias(
  ids: string[],
): Promise<Record<string, PessoaDenunciada>> {
  if (!supabase || ids.length === 0) return {};
  const { data, error } = await supabase
    .from('perfil')
    .select('id, nome, telefone')
    .in('id', ids);
  if (error) throw new Error(error.message);
  const pessoas: Record<string, PessoaDenunciada> = {};
  for (const r of (data ?? []) as {
    id: string;
    nome: string | null;
    telefone: string | null;
  }[]) {
    pessoas[r.id] = { nome: r.nome ?? undefined, telefone: r.telefone ?? undefined };
  }
  return pessoas;
}

/**
 * Dar a denúncia por tratada.
 *
 * A hora é escrita daqui e não pelo servidor, ao contrário do `criado_em` das
 * mensagens: aquela decide quem lê o quê e não podia vir de um relógio de
 * telemóvel; esta é o registo de quando o administrador da plataforma decidiu,
 * e quem a escreve é a única conta que a política deixa escrever.
 *
 * Devolve a razão do servidor quando falha, `null` quando corre bem (é a
 * convenção do `superadminApi.ts`).
 */
export async function tratarDenuncia(id: string, nota?: string): Promise<string | null> {
  if (!supabase) return 'Supabase não configurado.';
  const limpa = nota?.trim();
  const { error } = await supabase
    .from('mensagem_denuncia')
    .update({
      estado: 'tratada',
      tratado_em: new Date().toISOString(),
      nota_superadmin: limpa ? limpa : null,
    })
    .eq('id', id);
  return error?.message ?? null;
}

/**
 * Voltar a abrir uma que se fechou cedo demais.
 *
 * A nota fica: é o registo do que se pensou da primeira vez, e apagá-la ao
 * reabrir era perder a única coisa escrita sobre o caso.
 */
export async function reabrirDenuncia(id: string): Promise<string | null> {
  if (!supabase) return 'Supabase não configurado.';
  const { error } = await supabase
    .from('mensagem_denuncia')
    .update({ estado: 'aberta', tratado_em: null })
    .eq('id', id);
  return error?.message ?? null;
}

/**
 * O endereço temporário do ficheiro denunciado.
 *
 * Não usa o `ligacaoParaAnexo` do `useChat.ts` de propósito: esse traz atrás a
 * loja de módulo das conversas, a subscrição de tempo real e o registo do
 * push, e o painel de superadmin não abre conversas nenhumas. São quatro
 * linhas repetidas para não acordar a app de mensagens dentro do painel de
 * administração.
 *
 * A política do bucket só devolve isto enquanto existir uma denúncia com este
 * caminho (`chat_bucket_read`, no `schema_chat_anexos.sql`), e o ficheiro só
 * sobrevive à limpeza enquanto a denúncia estiver ABERTA.
 */
export async function ligacaoParaFicheiroDenunciado(caminho: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminho, SEGUNDOS_LIGACAO);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
