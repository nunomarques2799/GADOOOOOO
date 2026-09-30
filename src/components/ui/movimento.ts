import { AccessibilityInfo, Easing, Platform } from 'react-native';

/**
 * As regras de movimento da app, num sítio só.
 *
 * Entre 150 e 750 ms. A primeira versão (110 a 380 ms, com uma curva que
 * fazia quase todo o caminho nos primeiros instantes) ficou rápida de mais: o
 * Nuno pediu-as mais lentas a 2026-09-30, e o ecrã mudava antes de o olho o
 * acompanhar. Continua o cuidado do outro lado: uma animação que se arrasta
 * parece a app encravada a quem tem 80 anos, por isso nada passa de 750 ms, e
 * tudo POUSA devagar em vez de travar a direito.
 *
 * E tudo DESLIGADO em dois casos:
 *   - com "Reduzir movimento" ligado no telemóvel (ou no sistema, na web): há
 *     quem fique indisposto com ecrãs a deslizar, e é para isso que a opção
 *     existe;
 *   - nos testes automáticos, onde uma animação de 300 ms só serve para os
 *     tornar lentos e deixar o ecrã a meio caminho quando o teste olha para ele.
 */

export const DURACAO = {
  /** O cartão ou o botão a encolher ao toque. */
  toque: 150,
  /** O fundo escuro de uma folha a aparecer. */
  fundo: 320,
  /** A folha a descer ao fechar (a subir é uma mola, sem duração fixa). */
  folhaFechar: 300,
  /** Mudar de separador na barra de baixo. */
  separador: 340,
  /** Um ecrã a entrar, na web e no Windows (no telemóvel é o sistema). */
  ecra: 420,
  /** Cada cartão de uma lista em cascata. */
  cascata: 360,
  /** O intervalo entre dois cartões da cascata. */
  cascataPasso: 70,
  /** O retrato do animal a voar da lista para a ficha. */
  voo: 560,
  /** O visto do Guardar, antes de o formulário fechar. */
  visto: 750,
  /** Um ecrã a entrar no telemóvel (a pilha nativa; o iOS respeita-o). */
  ecraNativo: 420,
} as const;

/**
 * Pousa devagar, com o movimento repartido pela duração toda.
 *
 * Era `(0.2, 0.8, 0.2, 1)`, que fazia 80% do caminho nos primeiros 40 ms:
 * por muito que se alongasse a duração, o que se via era um salto seguido de
 * um arrastar invisível. Esta é a "ease-out cúbica" de sempre.
 */
export const ABRANDAR = Easing.bezier(0.33, 1, 0.68, 1);

/**
 * O driver nativo (a animação corre fora do JavaScript) só existe no
 * telemóvel. Na web o React Native Web avisa e cai para o JavaScript, por isso
 * pede-se só onde existe.
 */
export const NATIVO = Platform.OS !== 'web';

const EM_TESTES = process.env.NODE_ENV === 'test';

let reduzir = false;
try {
  void AccessibilityInfo.isReduceMotionEnabled?.()
    .then((v) => {
      reduzir = !!v;
    })
    .catch(() => undefined);
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
    reduzir = !!v;
  });
} catch {
  /* sem acessibilidade (ambiente estranho): fica com movimento */
}

/** Se agora não se anima nada (Reduzir movimento, ou testes). */
export function semMovimento(): boolean {
  return EM_TESTES || reduzir;
}
