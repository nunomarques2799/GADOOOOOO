import { AccessibilityInfo, Easing, Platform } from 'react-native';

/**
 * As regras de movimento da app, num sítio só.
 *
 * Tudo curto (entre 110 e 380 ms): para quem tem 80 anos, uma animação lenta
 * não parece elegante, parece a app encravada. Tudo a SAIR depressa e a POUSAR
 * devagar, que é o que o olho acompanha sem esforço.
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
  toque: 110,
  /** O fundo escuro de uma folha a aparecer. */
  fundo: 200,
  /** A folha a descer ao fechar (a subir é uma mola, sem duração fixa). */
  folhaFechar: 220,
  /** Mudar de separador na barra de baixo. */
  separador: 220,
  /** Um ecrã a entrar, na web e no Windows (no telemóvel é o sistema). */
  ecra: 260,
  /** Cada cartão de uma lista em cascata. */
  cascata: 220,
  /** O intervalo entre dois cartões da cascata. */
  cascataPasso: 40,
  /** O retrato do animal a voar da lista para a ficha. */
  voo: 350,
  /** O visto do Guardar, antes de o formulário fechar. */
  visto: 450,
} as const;

/** Sai depressa e pousa devagar. */
export const ABRANDAR = Easing.bezier(0.2, 0.8, 0.2, 1);

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
