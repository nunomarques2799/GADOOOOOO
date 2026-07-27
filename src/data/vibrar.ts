/**
 * Retorno tátil — a app sentir-se, não só ver-se.
 * ------------------------------------------------------------------
 * Um registo confirmado por um toque curto no aparelho é confirmação que não
 * exige ler nada. Isto conta para o utilizador-alvo: 82 anos, muitas vezes com
 * o telemóvel ao sol (onde um cartão verde ao fundo do ecrã se perde), de pé no
 * campo, às vezes de luvas. E conta ainda mais para os erros: uma gravação
 * recusada passa a sentir-se mesmo que o aviso não seja lido.
 *
 * Vive ao lado dos toasts de propósito: é o `mostrar()` de `toasts.tsx` que
 * chama isto, por isso toda a ação que já dava sinal visual passou a dar sinal
 * tátil, sem se mexer em nenhum ecrã.
 *
 * NÃO tem `.web.ts`: o `expo-haptics` traz implementação de web (usa o
 * `navigator.vibrate`, e no Safari um truque com um interruptor escondido), e
 * quando o navegador não a suporta não faz nada — que é exatamente o que se
 * quer. Assim a app instalada no Android vibra também.
 */

import * as Haptics from 'expo-haptics';

import { guardar, ler } from './armazenamento';

const CHAVE = 'gado.vibracao.v1';

/**
 * Ligado por omissão. O sistema operativo tem a última palavra — com a
 * vibração desligada nas definições do telemóvel, nada disto se sente.
 */
export function vibracaoLigada(): boolean {
  try {
    return ler(CHAVE) !== 'off';
  } catch {
    return true;
  }
}

export function definirVibracao(ligada: boolean): void {
  guardar(CHAVE, ligada ? 'on' : 'off');
}

/**
 * Nada disto é esperado por quem chama.
 *
 * Uma vibração é acessório: se o aparelho não a suportar, se o utilizador tirou
 * a autorização, ou se o módulo nativo não está no build (a app instalada antes
 * de este plugin entrar), a gravação que a mandou não pode falhar por causa
 * disso. Por isso é fogo-e-esquece, com a falha engolida.
 */
function sentir(disparar: () => Promise<void>): void {
  if (!vibracaoLigada()) return;
  try {
    void disparar().catch(() => undefined);
  } catch {
    /* módulo indisponível — segue sem vibrar */
  }
}

/** Correu bem: um toque duplo curto. */
export function vibrarSucesso(): void {
  sentir(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Não correu: padrão mais longo e irregular, para não se confundir com o "bem". */
export function vibrarErro(): void {
  sentir(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** Atenção — o que tem de ser lido antes de continuar (ver `avisos.ts`). */
export function vibrarAviso(): void {
  sentir(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
