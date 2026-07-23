/**
 * Repositório Supabase — CRUD assíncrono para as entidades do domínio.
 * ------------------------------------------------------------------
 * Usado pelo store quando há sessão iniciada. As RLS no Supabase
 * filtram automaticamente por membro/role — não é preciso passar
 * user_id nos SELECTs, o server só devolve o que o utilizador vê.
 *
 * Convenção: BD usa snake_case, domínio camelCase. O mapeamento
 * fica centralizado aqui para os componentes ficarem só com os tipos.
 */

import { traduzErroServidor } from './errosServidor';
import { supabase } from './supabase';
import type {
  Animal,
  CategoriaMovimento,
  Direcao,
  Especie,
  EstadoAnimal,
  Evento,
  EventoTipo,
  Finalidade,
  Exploracao,
  Movimento,
  Sexo,
  Terreno,
  TipoTerreno,
} from './types';

/**
 * Erro devolvido quando outra pessoa alterou a linha desde a versão que
 * tínhamos. Reconhecido por `eConflito()` — o store trata-o à parte, porque
 * repetir não adianta (a versão do servidor continuaria à frente) e descartar
 * em silêncio seria perder trabalho.
 */
export const ERRO_CONFLITO = 'CONFLITO_DE_VERSAO';

export function eConflito(msg: string): boolean {
  return msg.startsWith(ERRO_CONFLITO);
}

/**
 * Tira o marcador técnico da frente da mensagem, para o criador ler só a
 * explicação. O marcador serve o código; a pessoa não tem nada com ele.
 */
export function mensagemLegivel(msg: string): string {
  return eConflito(msg) ? msg.slice(ERRO_CONFLITO.length).replace(/^:\s*/, '') : msg;
}

/** Todas as tabelas trazem a versão da linha (mantida pelo trigger). */
type ComUpdatedAt = { updated_at?: string | null };

type ExploracaoRow = ComUpdatedAt & {
  id: string;
  user_id: string;
  nome: string;
  marca_exploracao: string;
  nif_detentor: string;
  localizacao?: string | null;
  fotografia?: string | null;
  financas_ativas?: boolean | null;
  casa_ativa?: boolean | null;
};

type TerrenoRow = ComUpdatedAt & {
  id: string;
  exploracao_id: string;
  nome: string;
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  area?: number | null;
  tipo?: string | null;
};

type AnimalRow = ComUpdatedAt & {
  id: string;
  exploracao_id: string;
  terreno_id?: string | null;
  mae_id?: string | null;
  pai_id?: string | null;
  nome?: string | null;
  especie: string;
  sexo: string;
  data_nascimento: string;
  raca?: string | null;
  cor_pelagem?: string | null;
  casa?: string | null;
  numero_casa?: string | null;
  finalidade?: string | null;
  numero_identificacao?: string | null;
  data_identificacao?: string | null;
  tipo_identificacao?: string | null;
  fotografia?: string | null;
  fim_intervalo_seguranca?: string | null;
  data_prevista_parto?: string | null;
  comunicado_snira?: boolean | null;
  estado?: string | null;
  data_saida?: string | null;
  motivo_saida?: string | null;
};

type EventoRow = ComUpdatedAt & {
  id: string;
  animal_id: string;
  tipo: string;
  data: string;
  descricao: string;
  detalhe?: string | null;
  valor?: number | null;
};

type MovimentoRow = ComUpdatedAt & {
  id: string;
  exploracao_id: string;
  direcao: string;
  categoria: string;
  valor: number;
  data: string;
  descricao: string;
  contraparte?: string | null;
  animal_id?: string | null;
  terreno_id?: string | null;
  criado_por?: string | null;
};

/* ---- Mapeadores linha ↔ domínio ---- */

const toExploracao = (r: ExploracaoRow): Exploracao => ({
  atualizadoEm: r.updated_at ?? undefined,
  id: r.id,
  utilizadorId: r.user_id,
  nome: r.nome,
  marcaExploracao: r.marca_exploracao,
  nifDetentor: r.nif_detentor,
  localizacao: r.localizacao ?? undefined,
  fotografia: r.fotografia ?? undefined,
  financasAtivas: r.financas_ativas ?? false,
  casaAtiva: r.casa_ativa ?? false,
});

const toTerreno = (r: TerrenoRow): Terreno => ({
  atualizadoEm: r.updated_at ?? undefined,
  id: r.id,
  exploracaoId: r.exploracao_id,
  nome: r.nome,
  descricao: r.descricao ?? undefined,
  latitude: r.latitude ?? undefined,
  longitude: r.longitude ?? undefined,
  area: r.area ?? undefined,
  tipo: (r.tipo as TipoTerreno) ?? undefined,
});

const toAnimal = (r: AnimalRow): Animal => ({
  atualizadoEm: r.updated_at ?? undefined,
  id: r.id,
  exploracaoId: r.exploracao_id,
  terrenoId: r.terreno_id ?? undefined,
  maeId: r.mae_id ?? undefined,
  paiId: r.pai_id ?? undefined,
  nome: r.nome ?? undefined,
  especie: r.especie as Especie,
  sexo: r.sexo as Sexo,
  dataNascimento: r.data_nascimento,
  raca: r.raca ?? undefined,
  corPelagem: r.cor_pelagem ?? undefined,
  casa: r.casa ?? undefined,
  numeroCasa: r.numero_casa ?? undefined,
  finalidade: (r.finalidade as Finalidade | null) ?? undefined,
  numeroIdentificacao: r.numero_identificacao ?? undefined,
  dataIdentificacao: r.data_identificacao ?? undefined,
  tipoIdentificacao: r.tipo_identificacao ?? undefined,
  fotografia: r.fotografia ?? undefined,
  fimIntervaloSeguranca: r.fim_intervalo_seguranca ?? undefined,
  dataPrevistaParto: r.data_prevista_parto ?? undefined,
  comunicadoSnira: r.comunicado_snira ?? undefined,
  estado: (r.estado as EstadoAnimal | null) ?? undefined,
  dataSaida: r.data_saida ?? undefined,
  motivoSaida: r.motivo_saida ?? undefined,
});

const toEvento = (r: EventoRow): Evento => ({
  atualizadoEm: r.updated_at ?? undefined,
  id: r.id,
  animalId: r.animal_id,
  tipo: r.tipo as EventoTipo,
  data: r.data,
  descricao: r.descricao,
  detalhe: r.detalhe ?? undefined,
  valor: r.valor ?? undefined,
});

const toMovimento = (r: MovimentoRow): Movimento => ({
  atualizadoEm: r.updated_at ?? undefined,
  id: r.id,
  exploracaoId: r.exploracao_id,
  direcao: r.direcao as Direcao,
  categoria: r.categoria as CategoriaMovimento,
  valor: Number(r.valor),
  data: r.data,
  descricao: r.descricao,
  contraparte: r.contraparte ?? undefined,
  animalId: r.animal_id ?? undefined,
  terrenoId: r.terreno_id ?? undefined,
  criadoPor: r.criado_por ?? undefined,
});

/* ---- Payloads para INSERT/UPSERT (omitem `id` gerado no client) ---- */

const exploracaoPayload = (e: Exploracao) => ({
  id: e.id,
  nome: e.nome,
  marca_exploracao: e.marcaExploracao,
  nif_detentor: e.nifDetentor,
  localizacao: e.localizacao ?? null,
  fotografia: e.fotografia ?? null,
  // `financas_ativas` e `casa_ativa` não vão no payload de propósito: são do
  // servidor, escritas só pelos RPC respetivos. Incluí-las aqui fazia com que
  // renomear a exploração num aparelho com a cache antiga voltasse a desligar
  // (ou a ligar) a opção sem ninguém ter pedido nada.
});

/** Liga ou desliga a gestão económica em toda a conta. Devolve erro ou null. */
export async function definirFinancasAtivas(ativas: boolean): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.rpc('definir_financas_ativas', { ativas });
  return error ? traduzErroServidor(error.message) : null;
}

/** Liga ou desliga o registo por casa/número em toda a conta. Erro ou null. */
export async function definirCasaAtiva(ativa: boolean): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.rpc('definir_casa_ativa', { ativa });
  return error ? traduzErroServidor(error.message) : null;
}

const terrenoPayload = (t: Terreno) => ({
  id: t.id,
  exploracao_id: t.exploracaoId,
  nome: t.nome,
  descricao: t.descricao ?? null,
  latitude: t.latitude ?? null,
  longitude: t.longitude ?? null,
  area: t.area ?? null,
  tipo: t.tipo ?? null,
});

const animalPayload = (a: Animal) => ({
  id: a.id,
  exploracao_id: a.exploracaoId,
  terreno_id: a.terrenoId ?? null,
  mae_id: a.maeId ?? null,
  pai_id: a.paiId ?? null,
  nome: a.nome ?? null,
  especie: a.especie,
  sexo: a.sexo,
  data_nascimento: a.dataNascimento,
  raca: a.raca ?? null,
  cor_pelagem: a.corPelagem ?? null,
  casa: a.casa ?? null,
  numero_casa: a.numeroCasa ?? null,
  finalidade: a.finalidade ?? null,
  numero_identificacao: a.numeroIdentificacao ?? null,
  data_identificacao: a.dataIdentificacao ?? null,
  tipo_identificacao: a.tipoIdentificacao ?? null,
  fotografia: a.fotografia ?? null,
  fim_intervalo_seguranca: a.fimIntervaloSeguranca ?? null,
  data_prevista_parto: a.dataPrevistaParto ?? null,
  comunicado_snira: a.comunicadoSnira ?? null,
  estado: a.estado ?? null,
  data_saida: a.dataSaida ?? null,
  motivo_saida: a.motivoSaida ?? null,
});

const eventoPayload = (e: Evento) => ({
  id: e.id,
  animal_id: e.animalId,
  tipo: e.tipo,
  data: e.data,
  descricao: e.descricao,
  detalhe: e.detalhe ?? null,
  valor: e.valor ?? null,
});

const movimentoPayload = (m: Movimento) => ({
  id: m.id,
  exploracao_id: m.exploracaoId,
  direcao: m.direcao,
  categoria: m.categoria,
  valor: m.valor,
  data: m.data.slice(0, 10), // a coluna é `date`; o domínio guarda ISO completo
  descricao: m.descricao,
  contraparte: m.contraparte ?? null,
  animal_id: m.animalId ?? null,
  terreno_id: m.terrenoId ?? null,
  // `criado_por` não vai no payload: o default da coluna é `auth.uid()` e a RLS
  // exige que seja o próprio. Deixá-lo ao servidor evita que um cliente
  // desatualizado (ou distraído) lance movimentos em nome de outra pessoa.
});

/**
 * A tabela não existe no servidor? `42P01` é o código do Postgres para
 * "undefined_table"; o PostgREST devolve `PGRST205` quando a tabela não está
 * no seu esquema em cache. Ver o uso em `carregarTudoSupabase`.
 */
function tabelaInexistente(erro: { code?: string; message?: string }): boolean {
  return erro.code === '42P01' || erro.code === 'PGRST205';
}

/* ---- Reads ---- */

export type Snapshot = {
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
  movimentos: Movimento[];
};

export async function carregarTudoSupabase(): Promise<Snapshot> {
  if (!supabase) {
    return { exploracoes: [], terrenos: [], animais: [], eventos: [], movimentos: [] };
  }
  const [expRes, terRes, aniRes, evtRes, movRes] = await Promise.all([
    supabase.from('exploracao').select('*').order('nome'),
    supabase.from('terreno').select('*').order('nome'),
    supabase.from('animal').select('*'),
    supabase.from('evento').select('*').order('data', { ascending: false }),
    // A RLS decide o que vem: o dono recebe a exploração toda, o trabalhador só
    // o que ele próprio lançou, o veterinário nada. Não é preciso filtrar aqui.
    supabase.from('movimento').select('*').order('data', { ascending: false }),
  ]);
  // Falhar em vez de devolver listas vazias: sem esta guarda, um erro de rede
  // (estar offline) devolveria tudo vazio e apagaria a cache local. Quem chama
  // trata o erro mantendo os dados que já tem em cache.
  const erro = expRes.error ?? terRes.error ?? aniRes.error ?? evtRes.error;
  if (erro) throw new Error(traduzErroServidor(erro.message));

  // A tabela `movimento` nasceu depois da app estar publicada, e a migração
  // (`supabase/schema_financas.sql`) é corrida à mão. Entre a nova versão
  // chegar ao telemóvel e o SQL ser aplicado há uma janela em que a tabela não
  // existe — e sem esta exceção o erro derrubava a leitura TODA, deixando a app
  // a parecer offline a toda a gente até alguém correr o script. Só se ignora
  // esta falha em concreto: qualquer outro erro continua a propagar.
  if (movRes.error && !tabelaInexistente(movRes.error)) {
    throw new Error(movRes.error.message);
  }
  const movimentos = movRes.error
    ? []
    : ((movRes.data ?? []) as MovimentoRow[]).map(toMovimento);
  return {
    exploracoes: ((expRes.data ?? []) as ExploracaoRow[]).map(toExploracao),
    terrenos: ((terRes.data ?? []) as TerrenoRow[]).map(toTerreno),
    animais: ((aniRes.data ?? []) as AnimalRow[]).map(toAnimal),
    eventos: ((evtRes.data ?? []) as EventoRow[]).map(toEvento),
    movimentos,
  };
}

/* ---- Writes ---- */

/**
 * Grava uma linha só se o servidor ainda estiver na versão que vimos.
 *
 * Sem esta guarda, dois aparelhos na mesma exploração sobrepunham-se em
 * silêncio: as escritas são da linha inteira, portanto quem sincroniza por
 * último repõe TODOS os campos com os valores que tinha em cache — incluindo
 * os que a outra pessoa entretanto corrigiu. Estando um deles offline umas
 * horas, a janela para isso não é de milissegundos, é de uma manhã.
 *
 * Nota sobre o zero-linhas: um UPDATE recusado pela RLS também devolve zero
 * linhas afetadas, sem erro. Confundir isso com conflito daria a mensagem
 * errada ao criador ("alguém alterou" quando na verdade é falta de
 * permissão), por isso, quando nada é gravado, vamos ler a linha para
 * perceber qual dos dois casos é.
 */
/**
 * Uma recusa da RLS pode ser falta de permissão — ou falta de sessão.
 *
 * As duas chegam com a mesma frase: as políticas comparam `auth.uid()` com o
 * dono da linha, e sem sessão válida `auth.uid()` é NULL, o que faz a condição
 * dar falso exatamente como daria a um intruso. A diferença importa muito para
 * quem está do outro lado: uma resolve-se voltando a entrar, a outra só com
 * outra pessoa a aprovar. Como o servidor não a diz, pergunta-se-lhe quem
 * somos — só quando já houve recusa, para não custar um pedido a cada gravação.
 */
export async function explicarRecusa(msg: string): Promise<string> {
  if (!supabase || !/row.level security/i.test(msg)) return traduzErroServidor(msg);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return 'A sua sessão terminou. Volte a entrar na conta e tente de novo — a alteração não se perdeu.';
  }
  return traduzErroServidor(msg);
}

async function gravarComVersao(
  tabela: 'exploracao' | 'terreno' | 'animal' | 'evento' | 'movimento',
  id: string,
  versaoConhecida: string | undefined,
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (!supabase) return null;

  // Sem versão conhecida, a linha nunca veio do servidor: foi criada neste
  // aparelho e ainda não sincronizou. Não há outro autor com quem colidir.
  if (!versaoConhecida) {
    // `insert` e não `upsert`, ao contrário do que aqui esteve. O `upsert` do
    // PostgREST gera `INSERT … ON CONFLICT DO UPDATE`, e isso arrasta as
    // políticas de UPDATE para uma linha que ainda não existe. Na `exploracao`
    // isso é fatal: a política de UPDATE exige `role_em(id) = 'admin'`, e esse
    // papel só nasce no trigger `handle_new_exploracao`, que corre DEPOIS do
    // insert. Resultado: criar a primeira exploração levava 403 da RLS, apesar
    // de a política de INSERT (perfil ativo) estar satisfeita — o mesmo pedido
    // feito com `insert` passa.
    const { error } = await supabase.from(tabela).insert(payload);
    if (!error) return null;
    // 23505 = chave duplicada. A linha já lá está: ou o pedido anterior chegou
    // e a resposta é que se perdeu, ou a fila offline repetiu a operação. É o
    // caso que o `upsert` tratava sozinho, e que se trata aqui à mão para não
    // ter de o trazer de volta.
    if (error.code !== '23505') return await explicarRecusa(error.message);
    const { error: erroUpdate } = await supabase.from(tabela).update(payload).eq('id', id);
    return erroUpdate ? await explicarRecusa(erroUpdate.message) : null;
  }

  const { data, error } = await supabase
    .from(tabela)
    .update(payload)
    .eq('id', id)
    .lte('updated_at', versaoConhecida)
    .select('id');
  if (error) return await explicarRecusa(error.message);
  if (data && data.length > 0) return null;

  // Nada foi gravado — descobrir porquê.
  const { data: atual, error: erroLeitura } = await supabase
    .from(tabela)
    .select('updated_at')
    .eq('id', id)
    .maybeSingle();
  if (erroLeitura) return traduzErroServidor(erroLeitura.message);

  if (!atual) {
    // Ou foi eliminada por outra pessoa, ou a RLS nem sequer no-la deixa ver.
    // Recriá-la seria ressuscitar um registo que alguém apagou de propósito.
    return `${ERRO_CONFLITO}: o registo já não existe no servidor — foi eliminado por outra pessoa.`;
  }

  const versaoServidor = (atual as ComUpdatedAt).updated_at;
  const mudou =
    !!versaoServidor && Date.parse(versaoServidor) > Date.parse(versaoConhecida);
  if (!mudou) {
    // A versão não avançou, logo o que bloqueou não foi a versão: foi a RLS.
    return 'Não tem permissão para alterar este registo.';
  }
  // Cuidado com as palavras: `pareceErroDeRede` procura expressões como
  // "sem ligação", e uma mensagem de conflito que as contenha seria tomada
  // por falha de rede e devolvida à fila para sempre. O `eConflito` é
  // verificado antes dessa heurística, mas não convém depender só disso.
  return `${ERRO_CONFLITO}: outra pessoa alterou este registo antes de esta alteração chegar ao servidor.`;
}

export async function upsertExploracaoSupabase(e: Exploracao): Promise<string | null> {
  return gravarComVersao('exploracao', e.id, e.atualizadoEm, exploracaoPayload(e));
}

export async function eliminarExploracaoSupabase(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('exploracao').delete().eq('id', id);
  return error ? traduzErroServidor(error.message) : null;
}

export async function upsertTerrenoSupabase(t: Terreno): Promise<string | null> {
  return gravarComVersao('terreno', t.id, t.atualizadoEm, terrenoPayload(t));
}

export async function eliminarTerrenoSupabase(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('terreno').delete().eq('id', id);
  return error ? traduzErroServidor(error.message) : null;
}

export async function upsertAnimalSupabase(a: Animal): Promise<string | null> {
  return gravarComVersao('animal', a.id, a.atualizadoEm, animalPayload(a));
}

/**
 * Elimina pelo RPC, não por `delete` direto: o privilégio de DELETE na tabela
 * `animal` foi retirado ao papel `authenticated` (ver
 * `supabase/schema_eliminar.sql`), e o RPC é o único caminho. É ele que recusa
 * eliminar um animal com eventos ou com crias, devolvendo a razão em PT-PT.
 */
export async function eliminarAnimalSupabase(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.rpc('eliminar_animal', { animal_id: id });
  return error ? traduzErroServidor(error.message) : null;
}

export async function upsertEventoSupabase(e: Evento): Promise<string | null> {
  return gravarComVersao('evento', e.id, e.atualizadoEm, eventoPayload(e));
}

export async function upsertMovimentoSupabase(m: Movimento): Promise<string | null> {
  return gravarComVersao('movimento', m.id, m.atualizadoEm, movimentoPayload(m));
}

export async function eliminarMovimentoSupabase(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('movimento').delete().eq('id', id);
  return error ? traduzErroServidor(error.message) : null;
}
