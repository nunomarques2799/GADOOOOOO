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

import { t } from '@/i18n';

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
  /**
   * Criar animais e corrigir a FICHA: nome, brinco, raça, datas, e o terreno
   * onde o animal anda (que é uma coluna da ficha como as outras).
   *
   * Não inclui registar tratamentos — ver `registarTratamentos`. Foram a mesma
   * capacidade até 2026-07-30, e por isso o veterinário, que precisa da
   * segunda, ficava com a primeira de arrasto: podia trocar o brinco de um
   * animal e mudá-lo de courela.
   */
  | 'editarAnimais'
  /**
   * Escrever eventos na ficha de um animal — vacinas, medicamentos, partos,
   * pesagens — sem lhe tocar na ficha. É o ato veterinário.
   */
  | 'registarTratamentos'
  /**
   * Tirar um animal da lista. Não apaga nada: marca-o como eliminado e guarda
   * quem o fez (ver `supabase/schema_auditoria.sql`).
   */
  | 'eliminarAnimais'
  /** Marcar um animal como falecido ou vendido. */
  | 'registarSaida'
  /**
   * Marcar eventos na agenda da exploração: a feira, a entrega da ração, o dia
   * de carregar para o matadouro.
   *
   * NÃO é ajustável pessoa a pessoa (fora de `CAPACIDADES_GERIVEIS`), ao
   * contrário de quase tudo o que está à volta. Uma agenda que uns podem
   * escrever e outros não deixa de ser uma agenda da exploração e passa a ser
   * um mural de recados de meia dúzia — e o que se ganhava não paga o
   * interruptor a mais numa folha que já tem oito.
   */
  | 'marcarEventos'
  /** Lançar uma despesa da exploração (ração, energia, gasóleo, rendas…). */
  | 'registarDespesa'
  /** Lançar uma receita (venda, leite, subsídios). Decide quanto entrou. */
  | 'registarReceita'
  /** Pôr o custo (€) numa vacinação ou medicamento que se está a registar. */
  | 'registarCustoTratamento';

/**
 * O veterinário é uma VISITA, não um segundo dono: escreve o que fez ao animal
 * e mais nada. Não corrige fichas, não muda animais de terreno, não dá um
 * animal por morto ou vendido, não apaga registos, não toca na exploração nem
 * na equipa.
 *
 * Até 2026-07-30 tinha `editarAnimais`, que na altura queria dizer as duas
 * coisas ao mesmo tempo — corrigir a ficha e registar um tratamento. Quem vem à
 * exploração uma manhã ficava a poder trocar o brinco de um animal e mudá-lo de
 * courela, e nada disso é ato veterinário. Separadas as duas, fica só com a
 * segunda.
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
    'registarTratamentos',
    'eliminarAnimais',
    'registarSaida',
    'marcarEventos',
    'registarDespesa',
    'registarReceita',
    'registarCustoTratamento',
  ],
  trabalhador: [
    'gerirTerrenos',
    'editarAnimais',
    'registarTratamentos',
    'eliminarAnimais',
    'registarSaida',
    'marcarEventos',
    'registarDespesa',
    'registarCustoTratamento',
  ],
  veterinario: ['registarTratamentos', 'registarCustoTratamento'],
};

/**
 * Capacidades de CONSULTA. Vivem à parte das de escrita porque a regra da
 * conta suspensa é o inverso: suspensa não escreve, mas continua a poder ler.
 */
export type CapacidadeLeitura =
  /** Abrir o ecrã Finanças: saldo, dashboards, movimentos de toda a exploração. */
  | 'verFinancas'
  /** Ver o custo/resultado económico na ficha de um animal. */
  | 'verBalancoAnimal'
  /**
   * Abrir o separador Documentos: importar e exportar o efetivo, relatórios,
   * notas.
   *
   * Ao contrário das outras duas, esta NÃO tem uma política de RLS por trás — é
   * uma decisão da interface. O que os Documentos fazem é reempacotar dados que
   * quem os abre já pode ler, portanto não há nada que o servidor possa recusar
   * sem lhe fechar também a lista de animais, de que ele precisa para
   * trabalhar. Fica escrito aqui para não se tomar por uma barreira que não é:
   * ao veterinário fecha-se a porta da frente, e é quanto se consegue.
   */
  | 'verDocumentos'
  /**
   * Ver o calendário da exploração e os eventos marcados nele.
   *
   * Esta, ao contrário dos Documentos, TEM política de RLS por trás
   * (`tem_agenda()` em `supabase/schema_agenda.sql`): a agenda não reempacota
   * nada que o veterinário já pudesse ler, portanto fechá-la no servidor não
   * lhe tira nada do trabalho.
   */
  | 'verAgenda';

/**
 * Consultar as contas é do dono. O trabalhador e o veterinário veem apenas o
 * que eles próprios lançaram (a RLS filtra por `criado_por`) — o suficiente
 * para corrigirem um erro de digitação, sem lhes abrir as margens da
 * exploração.
 *
 * Os Documentos ficam com quem tem a exploração a cargo todos os dias: o dono e
 * o trabalhador. O veterinário não tem que levar o efetivo de outra pessoa num
 * ficheiro Excel a caminho da quinta seguinte.
 */
const LEITURA: Record<RoleMembro, readonly CapacidadeLeitura[]> = {
  admin: ['verFinancas', 'verBalancoAnimal', 'verDocumentos', 'verAgenda'],
  trabalhador: ['verDocumentos', 'verAgenda'],
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
  'registarTratamentos',
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
      return 'Fichas dos animais';
    case 'registarTratamentos':
      return 'Tratamentos e registos';
    case 'eliminarAnimais':
      return 'Eliminar animais';
    case 'registarSaida':
      return 'Mortes e vendas';
    case 'marcarEventos':
      return 'Marcar eventos';
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
      return 'Registar animais novos e corrigir a ficha: nome, brinco, raça, datas, e o terreno onde o animal anda.';
    case 'registarTratamentos':
      return 'Lançar vacinas, medicamentos, partos e pesagens na ficha de um animal, sem poder alterar a ficha em si.';
    case 'eliminarAnimais':
      return 'Tirar um animal da lista para sempre. O registo fica guardado no histórico do efetivo, com o nome de quem o eliminou.';
    case 'registarSaida':
      return 'Marcar um animal como falecido ou vendido.';
    case 'marcarEventos':
      return 'Marcar no calendário da exploração o que aí vem: a feira, a entrega da ração, o dia de carregar.';
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

/**
 * Esta conta entrou pela porta de outra pessoa?
 *
 * "Convidada" é a conta que tem vínculos e nenhum deles é de dono. A pergunta é
 * feita assim, e não "é veterinário?", porque o que importa não é o papel: é a
 * conta ter chegado por um código. Um veterinário que também tenha a sua
 * exploração é admin nalgum lado e não é convidado de ninguém.
 *
 * Uma conta NOVA, ainda sem vínculo nenhum, não é convidada — e tem de o não
 * ser, ou ninguém conseguiria criar a primeira exploração.
 *
 * Recebe TODOS os vínculos, incluindo os que já expiraram: o veterinário cujo
 * acesso caiu ontem continua a ser uma visita, e a alternativa era ele ganhar o
 * direito de criar explorações no instante exato em que o prazo acabou.
 * Espelha `eh_convidado()` em `supabase/schema_papel_veterinario.sql`.
 */
export function eConvidado(papeis: readonly RoleMembro[]): boolean {
  return papeis.length > 0 && !papeis.includes('admin');
}

/**
 * Pode criar uma exploração nova?
 *
 * Não é uma `Capacidade` porque não se exerce DENTRO de uma exploração — a
 * pergunta é sobre a conta inteira, e passá-la pelo `pode(exploracaoId, …)`
 * obrigava a inventar uma exploração para perguntar por ela.
 *
 * Espelha a política `exploracao_ativo_insert`.
 */
export function podeCriarExploracao(
  ctx: ContextoAcesso & { papeis: readonly RoleMembro[] },
): boolean {
  if (!ctx.supabaseConfigurado || !ctx.temSessao) return true;
  if (ctx.isSuperadmin) return true;
  if (ctx.estadoPerfil !== 'ativo') return false;
  return !eConvidado(ctx.papeis);
}

/** Nome do papel para mostrar ao utilizador. */
export function legendaRole(role: RoleMembro): string {
  if (role === 'admin') return t('papel.dono');
  if (role === 'trabalhador') return t('papel.trabalhador');
  return t('papel.veterinario');
}
