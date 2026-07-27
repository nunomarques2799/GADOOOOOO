/**
 * O que cada papel pode fazer dentro de uma exploração.
 * ------------------------------------------------------------------
 * Lógica pura, sem React e sem rede, para poder ser testada — é a tabela que
 * decide o que a interface mostra a cada pessoa.
 *
 * ESTA TABELA ESPELHA AS POLÍTICAS RLS de `supabase/schema_roles.sql` (e os
 * ajustes por pessoa, de `supabase/schema_permissoes.sql`). O
 * servidor é quem manda: mesmo que um botão apareça por engano, a RLS recusa a
 * escrita. O objetivo aqui é o inverso — não deixar aparecer um botão que o
 * servidor vai recusar, porque uma recusa feita offline só se descobre na
 * sincronização, e até lá o criador julga que gravou.
 *
 * Ao mexer numa política do SQL, mexer também aqui (e no teste).
 */

import type { EstadoPerfil, RoleMembro } from './types';

export type Capacidade =
  /** Mudar nome, marca, NIF ou localização da exploração. */
  | 'editarExploracao'
  /** Apagar a exploração inteira, com terrenos, animais e histórico. */
  | 'eliminarExploracao'
  /** Convidar, listar e remover membros da equipa. */
  | 'gerirEquipa'
  /** Criar, editar e apagar terrenos. */
  | 'gerirTerrenos'
  /** Criar e editar animais, e registar eventos. */
  | 'editarAnimais'
  /**
   * Tirar um animal da lista. Não apaga nada: marca-o como eliminado e guarda
   * quem o fez (ver `supabase/schema_auditoria.sql`).
   */
  | 'eliminarAnimais'
  /** Marcar um animal como falecido ou vendido. */
  | 'registarSaida'
  /** Lançar uma despesa da exploração (ração, energia, gasóleo, rendas…). */
  | 'registarDespesa'
  /** Lançar uma receita (venda, leite, subsídios). Decide quanto entrou. */
  | 'registarReceita'
  /** Pôr o custo (€) numa vacinação ou medicamento que se está a registar. */
  | 'registarCustoTratamento';

/**
 * O veterinário trata dos animais, não do património: mexe nas fichas e regista
 * eventos e saídas (certificar uma morte é ato veterinário), mas não apaga
 * registos nem toca em terrenos, na exploração ou na equipa.
 *
 * No dinheiro a régua é mais apertada, e a assimetria é de propósito: o
 * trabalhador lança despesas (é ele que traz a fatura da ração do armazém), o
 * veterinário só põe o preço do tratamento que acabou de dar, e as receitas
 * são só do dono — quanto se vendeu um animal não é assunto de quem o carregou
 * para o camião.
 */
const PERMISSOES: Record<RoleMembro, readonly Capacidade[]> = {
  admin: [
    'editarExploracao',
    'eliminarExploracao',
    'gerirEquipa',
    'gerirTerrenos',
    'editarAnimais',
    'eliminarAnimais',
    'registarSaida',
    'registarDespesa',
    'registarReceita',
    'registarCustoTratamento',
  ],
  trabalhador: [
    'gerirTerrenos',
    'editarAnimais',
    'eliminarAnimais',
    'registarSaida',
    'registarDespesa',
    'registarCustoTratamento',
  ],
  veterinario: ['editarAnimais', 'registarSaida', 'registarCustoTratamento'],
};

/**
 * Capacidades de CONSULTA. Vivem à parte das de escrita porque a regra da
 * conta suspensa é o inverso: suspensa não escreve, mas continua a poder ler.
 */
export type CapacidadeLeitura =
  /** Abrir o ecrã Finanças: saldo, dashboards, movimentos de toda a exploração. */
  | 'verFinancas'
  /** Ver o custo/resultado económico na ficha de um animal. */
  | 'verBalancoAnimal';

/**
 * Consultar as contas é do dono. O trabalhador e o veterinário veem apenas o
 * que eles próprios lançaram (a RLS filtra por `criado_por`) — o suficiente
 * para corrigirem um erro de digitação, sem lhes abrir as margens da
 * exploração.
 */
const LEITURA: Record<RoleMembro, readonly CapacidadeLeitura[]> = {
  admin: ['verFinancas', 'verBalancoAnimal'],
  trabalhador: [],
  veterinario: [],
};

/**
 * Capacidades que só existem com a gestão económica LIGADA na exploração.
 *
 * A lista está aqui, e não espalhada pelos ecrãs, porque é o mesmo conjunto
 * que a RLS de `supabase/schema_financas_opcional.sql` bloqueia do lado do
 * servidor. Um ecrã que se esqueça do interruptor mostra um botão que o
 * servidor vai recusar — e, feito offline, essa recusa só aparece na
 * sincronização, quando o criador já julga que gravou.
 *
 * Ver `useFinancas()`, que é quem faz o "E" entre isto e o papel.
 */
const DEPENDEM_DAS_FINANCAS: readonly (Capacidade | CapacidadeLeitura)[] = [
  'registarDespesa',
  'registarReceita',
  'registarCustoTratamento',
  'verFinancas',
  'verBalancoAnimal',
];

/** true se esta capacidade fica indisponível com as finanças desligadas. */
export function exigeFinancasAtivas(capacidade: Capacidade | CapacidadeLeitura): boolean {
  return DEPENDEM_DAS_FINANCAS.includes(capacidade);
}

/* ------------------------------------------------------------------ *
 *  Ajustes por pessoa
 * ------------------------------------------------------------------ */

/**
 * O que o dono mudou às permissões de UMA pessoa numa exploração.
 *
 * Só o que foi mexido aparece aqui: uma capacidade ausente segue o papel. É
 * essa diferença que faz um trabalhador continuar a acompanhar a tabela acima
 * quando ela mudar — se se guardasse a lista inteira, cada pessoa ficava
 * congelada nas regras do dia em que foi convidada.
 *
 * Guardado na coluna `permissoes` (jsonb) de `membro_exploracao`; o servidor lê
 * a mesma tabela em `pode_cap()` (ver `supabase/schema_permissoes.sql`).
 */
export type PermissoesMembro = Partial<Record<Capacidade, boolean>>;

/**
 * As capacidades que o dono pode dar ou tirar a alguém da equipa.
 *
 * As que ficam de fora — `editarExploracao`, `eliminarExploracao`,
 * `gerirEquipa` — são de quem responde pela exploração: mudar o NIF ou a marca,
 * apagar tudo, convidar e remover pessoas. Deixá-las ajustáveis permitia um
 * trabalhador convidar outros ou apagar a exploração inteira, e um convite
 * passava a poder passar-se a si próprio de convidado a dono.
 */
export const CAPACIDADES_GERIVEIS: readonly Capacidade[] = [
  'gerirTerrenos',
  'editarAnimais',
  'registarSaida',
  'eliminarAnimais',
  'registarDespesa',
  'registarReceita',
  'registarCustoTratamento',
];

/** true se esta capacidade se pode dar/tirar pessoa a pessoa. */
export function capacidadeGerivel(capacidade: Capacidade): boolean {
  return CAPACIDADES_GERIVEIS.includes(capacidade);
}

/**
 * true se o papel dado pode exercer a capacidade. Sem papel, não pode nada.
 *
 * `ajustes` são as mudanças que o dono fez a esta pessoa (ver
 * `PermissoesMembro`). Não se aplicam ao `admin` — o dono não se limita a si
 * próprio, e uma linha de ajustes na conta dele fechava-o fora da sua
 * exploração sem ninguém para o desbloquear.
 */
export function rolePode(
  role: RoleMembro | undefined,
  capacidade: Capacidade,
  ajustes?: PermissoesMembro,
): boolean {
  if (!role) return false;
  const padrao = PERMISSOES[role].includes(capacidade);
  if (role === 'admin' || !capacidadeGerivel(capacidade)) return padrao;
  const ajuste = ajustes?.[capacidade];
  return typeof ajuste === 'boolean' ? ajuste : padrao;
}

/**
 * As capacidades ajustadas para o efeito que têm — o que a pessoa pode ou não,
 * já com o papel e os ajustes cruzados. É o que a folha de permissões mostra.
 */
export function permissoesEfetivas(
  role: RoleMembro,
  ajustes?: PermissoesMembro,
): { capacidade: Capacidade; pode: boolean; ajustada: boolean }[] {
  return CAPACIDADES_GERIVEIS.map((c) => ({
    capacidade: c,
    pode: rolePode(role, c, ajustes),
    // "Diferente do que o papel dá" — é o que o ecrã marca, para se ver de
    // relance o que foi mexido à mão e o que veio do papel.
    ajustada: rolePode(role, c) !== rolePode(role, c, ajustes),
  }));
}

/** O nome de uma capacidade, para o dono a reconhecer numa lista. */
export function legendaCapacidade(c: Capacidade): string {
  switch (c) {
    case 'editarExploracao':
      return 'Editar a exploração';
    case 'eliminarExploracao':
      return 'Eliminar a exploração';
    case 'gerirEquipa':
      return 'Gerir a equipa';
    case 'gerirTerrenos':
      return 'Terrenos';
    case 'editarAnimais':
      return 'Animais e registos';
    case 'eliminarAnimais':
      return 'Eliminar animais';
    case 'registarSaida':
      return 'Mortes e vendas';
    case 'registarDespesa':
      return 'Despesas';
    case 'registarReceita':
      return 'Receitas';
    case 'registarCustoTratamento':
      return 'Custo dos tratamentos';
  }
}

/** O que muda na prática, em linguagem de quem trabalha com gado. */
export function explicacaoCapacidade(c: Capacidade): string {
  switch (c) {
    case 'editarExploracao':
      return 'Mudar nome, marca de exploração, NIF ou localização.';
    case 'eliminarExploracao':
      return 'Apagar a exploração com terrenos, animais e histórico.';
    case 'gerirEquipa':
      return 'Convidar e remover pessoas desta exploração.';
    case 'gerirTerrenos':
      return 'Criar, editar e apagar terrenos, e mudar animais de terreno.';
    case 'editarAnimais':
      return 'Registar animais novos, corrigir fichas e lançar vacinas, medicamentos, partos e pesagens.';
    case 'eliminarAnimais':
      return 'Tirar um animal da lista para sempre. O registo fica guardado no histórico do efetivo, com o nome de quem o eliminou.';
    case 'registarSaida':
      return 'Marcar um animal como falecido ou vendido.';
    case 'registarDespesa':
      return 'Lançar o que se gastou: ração, gasóleo, energia, rendas.';
    case 'registarReceita':
      return 'Lançar o que entrou: vendas, leite, subsídios, e o preço de uma venda.';
    case 'registarCustoTratamento':
      return 'Escrever o custo (€) de uma vacina ou de um medicamento que está a registar.';
  }
}

/** Tudo o que decide se esta pessoa pode escrever, neste momento. */
export type ContextoAcesso = {
  /** Há projeto Supabase configurado? (falso no modo demo/offline puro) */
  supabaseConfigurado: boolean;
  /** Há sessão iniciada? */
  temSessao: boolean;
  isSuperadmin: boolean;
  /** Estado do perfil de quem está a agir. */
  estadoPerfil: EstadoPerfil | null;
  /** Papel de quem está a agir NESTA exploração. */
  role: RoleMembro | undefined;
  /** Ajustes que o dono fez a esta pessoa nesta exploração, se houver. */
  permissoes?: PermissoesMembro;
};

/**
 * Decisão completa de escrita: modo da app + estado da conta + papel.
 * Espelha `pode_escrever_em()` + as políticas de `schema_suspensao.sql`.
 *
 * A ordem das perguntas importa e cada uma tem um modo de falhar próprio:
 * sem Supabase a app ficaria só de leitura; o superadmin ficaria fechado
 * fora das contas que precisa de assistir; e uma conta suspensa veria os
 * botões todos para depois cada gravação rebentar contra a RLS.
 */
export function podeEscrever(ctx: ContextoAcesso, capacidade: Capacidade): boolean {
  // Modo local/demo: não há equipa nem papéis — quem está no aparelho é o dono.
  if (!ctx.supabaseConfigurado || !ctx.temSessao) return true;
  if (ctx.isSuperadmin) return true;
  // Suspensa (ou ainda por aprovar): consulta sim, escrita não.
  if (ctx.estadoPerfil !== 'ativo') return false;
  return rolePode(ctx.role, capacidade, ctx.permissoes);
}

/**
 * Decisão de LEITURA. Espelha as políticas de SELECT de `schema_financas.sql`.
 *
 * Deliberadamente não pergunta pelo `estadoPerfil`: uma conta suspensa fica só
 * de leitura, portanto continua a consultar tudo o que consultava. Passar esta
 * decisão por `podeEscrever` escondia o ecrã Finanças ao dono no dia em que a
 * conta ficasse por regularizar — exatamente quando ele mais precisa de ver as
 * contas.
 */
export function podeConsultar(ctx: ContextoAcesso, capacidade: CapacidadeLeitura): boolean {
  if (!ctx.supabaseConfigurado || !ctx.temSessao) return true;
  if (ctx.isSuperadmin) return true;
  if (!ctx.role) return false;
  return LEITURA[ctx.role].includes(capacidade);
}

/** Nome do papel para mostrar ao utilizador. */
export function legendaRole(role: RoleMembro): string {
  if (role === 'admin') return 'Dono';
  if (role === 'trabalhador') return 'Trabalhador';
  return 'Veterinário';
}
