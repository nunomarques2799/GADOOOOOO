/**
 * Os primeiros passos — o fio condutor de quem abre a app pela primeira vez.
 * ------------------------------------------------------------------
 * Cada ecrã da app explica-se a si mesmo, mas nada dizia por ONDE começar. Uma
 * conta acabada de criar é uma sequência de estados vazios — sem explorações
 * não há onde pôr animais, sem animais não há alertas — e o criador de 82 anos,
 * sozinho, não tem porque adivinhar essa ordem.
 *
 * Isto é a lógica desse guia, à parte do ecrã para poder ser testada: quais são
 * os passos, quais já estão feitos (lido dos DADOS, não de uma caixa que se
 * marca — um passo "feito" é um animal que existe mesmo), e se o guia ainda se
 * mostra. O painel em si é `components/PainelPrimeirosPassos.tsx`.
 *
 * Persistido via `armazenamento.ts` (KV síncrono), como o resto das
 * preferências do aparelho.
 */

import { guardar as guardarKv, ler as lerKv } from './armazenamento';

export type ChavePasso = 'exploracao' | 'animal' | 'avisos';

export type Passo = {
  chave: ChavePasso;
  titulo: string;
  descricao: string;
  /** Já está cumprido? Vem dos dados reais, não de uma marca do utilizador. */
  feito: boolean;
};

/** O que a app sabe para decidir que passos estão cumpridos. */
export type EstadoTutorial = {
  temExploracoes: boolean;
  temAnimais: boolean;
  /** Os avisos no telemóvel estão ligados e autorizados. */
  avisosLigados: boolean;
  /** A plataforma agenda avisos locais? (falso na web/computador.) */
  suportaAvisos: boolean;
};

/**
 * Os passos, por ordem, com o estado de cada um.
 *
 * O passo dos avisos só entra onde há avisos para ligar: na web/computador a
 * app está sempre aberta à frente do criador e a lista de alertas faz o
 * trabalho, por isso prometer "avisamos-te no telemóvel" seria mentir.
 */
export function passosTutorial(e: EstadoTutorial): Passo[] {
  const passos: Passo[] = [
    {
      chave: 'exploracao',
      titulo: 'Criar a sua exploração',
      descricao: 'É onde entram os animais e os terrenos. Comece por aqui.',
      feito: e.temExploracoes,
    },
    {
      chave: 'animal',
      titulo: 'Registar o primeiro animal',
      descricao: 'Basta a espécie, o sexo e a idade — o resto fica para depois.',
      feito: e.temAnimais,
    },
  ];
  if (e.suportaAvisos) {
    passos.push({
      chave: 'avisos',
      titulo: 'Ligar os avisos no telemóvel',
      descricao: 'Para os prazos legais o avisarem a tempo, mesmo com a app fechada.',
      feito: e.avisosLigados,
    });
  }
  return passos;
}

/** Passos cumpridos e total — para a barra de progresso do painel. */
export function progresso(passos: Passo[]): { feitos: number; total: number; completo: boolean } {
  const feitos = passos.filter((p) => p.feito).length;
  return { feitos, total: passos.length, completo: feitos === passos.length };
}

/**
 * O guia deve aparecer?
 *
 * Enquanto houver passos por fazer e o criador não o tiver escondido. Quando
 * está tudo feito, deixa de aparecer sozinho — mas continua a poder ser
 * reaberto pela Ajuda, para quem o quiser rever.
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
