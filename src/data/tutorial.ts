/**
 * Os primeiros passos — o fio condutor de quem abre a app pela primeira vez.
 * ------------------------------------------------------------------
 * Cada ecrã da app explica-se a si mesmo, mas nada dizia por ONDE começar. Uma
 * conta acabada de criar é uma sequência de estados vazios — sem explorações
 * não há onde pôr terrenos, sem terrenos não se sabe onde anda o gado, sem
 * animais não há alertas — e o criador de 82 anos, sozinho, não tem porque
 * adivinhar essa ordem.
 *
 * Isto é a lógica desse guia, à parte do ecrã para poder ser testada: quais são
 * os passos, quais já estão feitos (lido dos DADOS, não de uma caixa que se
 * marca — um passo "feito" é um animal que existe mesmo), e se o guia ainda se
 * mostra. O painel em si é `components/PainelPrimeirosPassos.tsx`.
 *
 * Há duas famílias de passos:
 *
 *   - os ESSENCIAIS, que são o caminho até a app servir para alguma coisa
 *     (exploração → terrenos → animais → avisos). São estes que contam para a
 *     barra de progresso e que decidem quando o guia se cala;
 *   - os OPCIONAIS (a gestão do dinheiro), que são feitios da app que muita
 *     gente nunca quer. Aparecem para se saber que existem — nunca para ficarem
 *     por fazer: se contassem para o progresso, o guia ficava eternamente
 *     incompleto em cima do Início de quem não os quer.
 *
 * Persistido via `armazenamento.ts` (KV síncrono), como o resto das
 * preferências do aparelho.
 */

import { t } from '@/i18n';

import { guardar as guardarKv, ler as lerKv } from './armazenamento';

export type ChavePasso =
  | 'exploracao'
  | 'terreno'
  | 'animal'
  | 'avisos'
  | 'financas';

export type Passo = {
  chave: ChavePasso;
  titulo: string;
  /** Uma linha, sempre visível na lista. */
  descricao: string;
  /** A explicação por extenso, mostrada no passo que está a ser apontado. */
  detalhe: string;
  /** O que diz o botão desse passo. */
  acao: string;
  /** Feitio à escolha: não conta para o progresso nem prende o guia. */
  opcional: boolean;
  /** Já está cumprido? Vem dos dados reais, não de uma marca do utilizador. */
  feito: boolean;
};

/** O que a app sabe para decidir que passos estão cumpridos. */
export type EstadoTutorial = {
  temExploracoes: boolean;
  temTerrenos: boolean;
  temAnimais: boolean;
  /** Os avisos no telemóvel estão ligados e autorizados. */
  avisosLigados: boolean;
  /** A plataforma agenda avisos locais? (falso na web/computador.) */
  suportaAvisos: boolean;
  /** A gestão económica está ligada nalguma exploração. */
  financasLigadas: boolean;
  /**
   * É dono de alguma exploração? Só ele liga os interruptores da conta — a um
   * trabalhador convidado, esses passos são um convite a bater numa porta
   * fechada.
   */
  podeConfigurar: boolean;
};

/**
 * Os passos, por ordem, com o estado de cada um.
 *
 * A ordem não é decorativa: os terrenos vêm antes dos animais porque é no
 * formulário do animal que se diz em que terreno ele anda — ao contrário, esse
 * campo aparece vazio e sem nada por onde escolher.
 *
 * O passo dos avisos só entra onde há avisos para ligar: na web/computador a
 * app está sempre aberta à frente do criador e a lista de alertas faz o
 * trabalho, por isso prometer "avisamos-te no telemóvel" seria mentir.
 */
export function passosTutorial(e: EstadoTutorial): Passo[] {
  const passos: Passo[] = [
    {
      chave: 'exploracao',
      titulo: t('tutorial.exploracaoTitulo'),
      descricao: t('tutorial.exploracaoDescricao'),
      detalhe: t('tutorial.exploracaoDetalhe'),
      acao: t('tutorial.exploracaoAcao'),
      opcional: false,
      feito: e.temExploracoes,
    },
    {
      chave: 'terreno',
      titulo: t('tutorial.terrenoTitulo'),
      descricao: t('tutorial.terrenoDescricao'),
      detalhe: t('tutorial.terrenoDetalhe'),
      acao: t('tutorial.terrenoAcao'),
      opcional: false,
      feito: e.temTerrenos,
    },
    {
      chave: 'animal',
      titulo: t('tutorial.animalTitulo'),
      descricao: t('tutorial.animalDescricao'),
      detalhe: t('tutorial.animalDetalhe'),
      acao: t('tutorial.animalAcao'),
      opcional: false,
      feito: e.temAnimais,
    },
  ];

  if (e.suportaAvisos) {
    passos.push({
      chave: 'avisos',
      titulo: t('tutorial.avisosTitulo'),
      descricao: t('tutorial.avisosDescricao'),
      detalhe: t('tutorial.avisosDetalhe'),
      acao: t('tutorial.avisosAcao'),
      opcional: false,
      feito: e.avisosLigados,
    });
  }

  // O interruptor da conta: existe, mas não é toda a gente que o quer.
  if (e.podeConfigurar) {
    passos.push({
      chave: 'financas',
      titulo: t('tutorial.financasTitulo'),
      descricao: t('tutorial.financasDescricao'),
      detalhe: t('tutorial.financasDetalhe'),
      acao: t('tutorial.financasAcao'),
      opcional: true,
      feito: e.financasLigadas,
    });
  }

  return passos;
}

/** Só o caminho essencial — é dele que se faz o progresso. */
export function essenciais(passos: Passo[]): Passo[] {
  return passos.filter((p) => !p.opcional);
}

/** Os feitios à escolha, mostrados à parte. */
export function opcionais(passos: Passo[]): Passo[] {
  return passos.filter((p) => p.opcional);
}

/**
 * Passos cumpridos e total — para a barra de progresso do painel.
 *
 * Conta só os essenciais: um progresso que dissesse "3 de 5" a quem já tem a
 * app a funcionar, só porque não quer contabilidade, media o que ele não pediu.
 */
export function progresso(passos: Passo[]): { feitos: number; total: number; completo: boolean } {
  const conta = essenciais(passos);
  const feitos = conta.filter((p) => p.feito).length;
  return { feitos, total: conta.length, completo: feitos === conta.length };
}

/**
 * O guia deve aparecer?
 *
 * Enquanto houver passos essenciais por fazer e o criador não o tiver
 * escondido. Quando o caminho está andado, deixa de aparecer sozinho — mesmo
 * com opcionais por ligar — mas continua a poder ser reaberto pela Ajuda, para
 * quem o quiser rever.
 */
export function deveMostrar(passos: Passo[], escondido: boolean): boolean {
  if (escondido) return false;
  return !progresso(passos).completo;
}

/* ---- Persistência da decisão de esconder ---- */

const CHAVE = 'gado.tutorial-escondido.v1';

export function tutorialEscondido(): boolean {
  try {
    return lerKv(CHAVE) === '1';
  } catch {
    return false;
  }
}

export function esconderTutorial(): void {
  guardarKv(CHAVE, '1');
}

/** Volta a mostrar o guia (a partir da Ajuda). */
export function reporTutorial(): void {
  guardarKv(CHAVE, '0');
}
