/**
 * Entrar pelo Google, pela Apple ou pelo telemóvel.
 * ------------------------------------------------------------------
 * O email e a palavra-passe continuam a ser o caminho principal. Isto são as
 * outras portas, e cada uma delas só existe se as credenciais dela existirem —
 * um botão que abre e dá erro é pior do que um botão que não está lá.
 *
 * DUAS REGRAS QUE ESTE FICHEIRO EXISTE PARA CUMPRIR
 *
 * 1. **Nada de `import` no topo para os módulos nativos.** O
 *    `@react-native-google-signin/google-signin` e o
 *    `expo-apple-authentication` não existem dentro da app que o criador tem
 *    instalada: entraram agora e só passam a existir depois de um `eas build`.
 *    Um `import` no topo rebentava a app dele no `eas update` seguinte, antes
 *    sequer de ele chegar ao ecrã de entrada — uma entrega de JS a partir um
 *    ecrã que funcionava. Carregam-se por `require` dentro da função, com a
 *    falha engolida, exatamente como o `expo-camera` em `codigos.ts` e o som em
 *    `som.ts`.
 *
 * 2. **A decisão de MOSTRAR é pura e testada** (`metodosConfigurados`), e a de
 *    EXECUTAR é que toca no nativo. Assim consegue-se provar em Jest que uma
 *    conta sem credenciais de Google não vê o botão, sem simular o SDK.
 *
 * Como chega isto ao Supabase: os dois primeiros devolvem um `idToken` que o
 * `auth.tsx` entrega ao `signInWithIdToken`. O telemóvel não tem token nenhum —
 * é um código de seis dígitos por SMS, em dois passos (`signInWithOtp` e
 * `verifyOtp`), e por isso vive todo do lado do `auth.tsx`.
 *
 * Ver `ENTRAR-NA-CONTA.md` para os cliques que ligam cada um.
 */

import { Platform } from 'react-native';

export type MetodoLogin = 'google' | 'apple' | 'telemovel';

/** O que a app precisa de saber do ambiente para decidir o que mostrar. */
export type ConfigLogin = {
  /** O Client ID *web* do Google. É ele que o Supabase valida, em qualquer plataforma. */
  googleWebClientId?: string;
  /** O Client ID de iOS. Sem ele o botão do Google não funciona no iPhone. */
  googleIosClientId?: string;
  /**
   * O telemóvel está ligado? É um interruptor e não uma credencial de propósito:
   * cada SMS custa dinheiro, e há-de haver o dia em que se quer desligar isto
   * num minuto sem esperar por um build.
   */
  telemovelLigado: boolean;
  /** Onde a app está a correr. */
  plataforma: 'ios' | 'android' | 'web';
};

/** Lê a configuração das variáveis de ambiente. */
export function configDoAmbiente(): ConfigLogin {
  return {
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    telemovelLigado: process.env.EXPO_PUBLIC_LOGIN_TELEMOVEL === '1',
    plataforma: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  };
}

/**
 * Que portas é que esta app, aqui e agora, pode mostrar.
 *
 * O GOOGLE precisa do Client ID web em todo o lado (é o que o Supabase valida),
 * e no iPhone precisa TAMBÉM do de iOS — sem ele o SDK arranca e falha na hora
 * de pedir o token, com um erro que não diz nada a quem o lê.
 *
 * A APPLE só se mostra no iPhone. Na web e no Android ela existe pelo caminho do
 * navegador, e é uma porta que não se abre a ninguém: quem tem conta Apple tem
 * um iPhone à mão, e um botão que manda o utilizador de Android para um
 * formulário da Apple no browser é um convite a desistir a meio.
 *
 * O TELEMÓVEL segue o interruptor, e mais nada: as credenciais da Twilio vivem
 * do lado do Supabase e a app não as vê.
 */
export function metodosConfigurados(c: ConfigLogin): MetodoLogin[] {
  const fora: MetodoLogin[] = [];
  const googlePronto =
    !!c.googleWebClientId && (c.plataforma !== 'ios' || !!c.googleIosClientId);
  if (googlePronto) fora.push('google');
  if (c.plataforma === 'ios') fora.push('apple');
  if (c.telemovelLigado) fora.push('telemovel');
  return fora;
}

/* ------------------------------------------------------------------ *
 *  O que toca no nativo
 * ------------------------------------------------------------------ */

/** O que uma tentativa de entrar devolve: um token para o Supabase, ou a razão. */
export type Credencial = { idToken: string; nome?: string } | { erro: string } | { desistiu: true };

/** true quando quem estava a entrar carregou em cancelar. Não é erro nenhum. */
export function desistiu(r: Credencial): r is { desistiu: true } {
  return 'desistiu' in r;
}

/**
 * Carrega um módulo nativo sem rebentar onde ele não existe.
 *
 * O `eval` à volta do `require` não é superstição: os empacotadores olham para
 * um `require('x')` literal e metem o `x` dentro do pacote, que é precisamente
 * o que não se quer na web (onde estes módulos não existem) nem numa app
 * antiga a receber uma entrega de JS.
 */
function nativo<T>(nome: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
    const req = eval('require') as (m: string) => T;
    return req(nome);
  } catch {
    return null;
  }
}

type SdkGoogle = {
  GoogleSignin: {
    configure: (o: { webClientId?: string; iosClientId?: string }) => void;
    hasPlayServices: () => Promise<boolean>;
    signIn: () => Promise<{ type?: string; data?: { idToken?: string | null } | null }>;
    signOut: () => Promise<void>;
  };
};

/**
 * Pede ao Google que identifique quem está a usar o telemóvel.
 *
 * O `configure` corre a cada chamada e não uma vez no arranque, de propósito: no
 * arranque o módulo pode nem existir (ver o cabeçalho), e configurar um SDK que
 * não está lá é a exceção que derruba a app antes do primeiro ecrã.
 */
export async function entrarComGoogle(c = configDoAmbiente()): Promise<Credencial> {
  const sdk = nativo<SdkGoogle>('@react-native-google-signin/google-signin');
  if (!sdk?.GoogleSignin) return { erro: 'SEM_MODULO' };
  if (!c.googleWebClientId) return { erro: 'SEM_CREDENCIAIS' };

  try {
    sdk.GoogleSignin.configure({
      webClientId: c.googleWebClientId,
      iosClientId: c.googleIosClientId,
    });
    // Só o Android tem Play Services; no iPhone esta chamada não faz mal nenhum
    // e devolve true.
    await sdk.GoogleSignin.hasPlayServices();
    // Sair primeiro para a conta poder ser ESCOLHIDA. Sem isto, o SDK devolve
    // logo a última conta usada e quem tem duas contas Google no telemóvel não
    // consegue entrar na outra — sem nada no ecrã que explique porquê.
    await sdk.GoogleSignin.signOut().catch(() => undefined);
    const r = await sdk.GoogleSignin.signIn();
    const idToken = r?.data?.idToken;
    if (!idToken) return { desistiu: true };
    return { idToken };
  } catch (e) {
    const codigo = (e as { code?: string })?.code;
    if (codigo === 'SIGN_IN_CANCELLED' || codigo === '-5') return { desistiu: true };
    return { erro: (e as Error)?.message ?? 'GOOGLE_FALHOU' };
  }
}

type SdkApple = {
  isAvailableAsync: () => Promise<boolean>;
  signInAsync: (o: { requestedScopes: unknown[] }) => Promise<{
    identityToken?: string | null;
    fullName?: { givenName?: string | null; familyName?: string | null } | null;
  }>;
  AppleAuthenticationScope: { FULL_NAME: unknown; EMAIL: unknown };
};

/**
 * O mesmo, pela Apple.
 *
 * O NOME só vem à PRIMEIRA vez que a pessoa entra, e nunca mais — é a Apple que
 * o decide, e não há como voltar a pedi-lo. Por isso vai já no resultado, para
 * quem chama o poder gravar no perfil enquanto o tem. Da segunda vez em diante
 * chega `undefined`, e isso não é erro: é o esperado.
 */
export async function entrarComApple(): Promise<Credencial> {
  const sdk = nativo<SdkApple>('expo-apple-authentication');
  if (!sdk?.signInAsync) return { erro: 'SEM_MODULO' };

  try {
    if (!(await sdk.isAvailableAsync())) return { erro: 'SEM_MODULO' };
    const cred = await sdk.signInAsync({
      requestedScopes: [sdk.AppleAuthenticationScope.FULL_NAME, sdk.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) return { desistiu: true };
    const nome = [cred.fullName?.givenName, cred.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return { idToken: cred.identityToken, nome: nome || undefined };
  } catch (e) {
    const codigo = (e as { code?: string })?.code;
    if (codigo === 'ERR_REQUEST_CANCELED') return { desistiu: true };
    return { erro: (e as Error)?.message ?? 'APPLE_FALHOU' };
  }
}

/* ------------------------------------------------------------------ *
 *  Números de telemóvel
 * ------------------------------------------------------------------ */

/**
 * Põe o número na forma que o servidor espera: E.164, sem espaços nem traços.
 *
 * Um número escrito como "912 345 678" é recusado pelo Supabase com um erro que
 * fala de formato — e ninguém em Portugal escreve o indicativo do país quando
 * lhe pedem o telemóvel. Por isso: se vier sem `+`, assume-se Portugal.
 *
 * Devolve `null` quando não dá para aproveitar nada, e é aí que a app avisa em
 * vez de mandar o número ao servidor para ele recusar.
 */
export function normalizarTelemovel(bruto: string, indicativo = '351'): string | null {
  const limpo = bruto.replace(/[\s.\-()]/g, '');
  if (!limpo) return null;

  if (limpo.startsWith('+')) {
    const digitos = limpo.slice(1);
    return /^\d{8,15}$/.test(digitos) ? `+${digitos}` : null;
  }
  // "00351..." é a mesma coisa que "+351...", e é como está escrito em metade
  // das agendas antigas.
  if (limpo.startsWith('00')) {
    const digitos = limpo.slice(2);
    return /^\d{8,15}$/.test(digitos) ? `+${digitos}` : null;
  }
  if (!/^\d+$/.test(limpo)) return null;

  // Já traz o indicativo colado, sem o `+`: "351912345678".
  if (limpo.startsWith(indicativo) && limpo.length > 9) return `+${limpo}`;
  // O caso normal: nove dígitos portugueses.
  if (limpo.length === 9) return `+${indicativo}${limpo}`;
  return null;
}

/** O código que chega por SMS: seis dígitos, e mais nada. */
export function codigoSmsValido(codigo: string): boolean {
  return /^\d{6}$/.test(codigo.replace(/\s/g, ''));
}
