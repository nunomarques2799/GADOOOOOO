import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { t } from '@/i18n';
import { garantirDono, limparCache } from './cacheLocal';
import { traduzErroServidor } from './errosServidor';
import type { Intencao } from './intencao';
import { desistiu, entrarComApple, entrarComGoogle } from './loginExterno';
import { supabase, supabaseConfigurado } from './supabase';

/** Destino do link de recuperação de palavra-passe (página no site). */
const URL_RECUPERACAO = 'https://terrabovina.pt/recuperar';

/**
 * Traduz as mensagens de erro mais comuns do Supabase para a língua da app.
 *
 * Os textos vêm do `i18n` e são lidos AQUI, no momento do erro, e não numa
 * constante de módulo: o idioma é um valor de módulo do `i18n/idioma.ts` e uma
 * tabela criada no arranque ficaria presa à língua desse instante.
 */
function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return t('erroAuth.credenciais');
  if (m.includes('email not confirmed')) return t('erroAuth.emailPorConfirmar');
  if (m.includes('user already registered')) return t('erroAuth.contaJaExiste');
  if (m.includes('password should be at least')) return t('erroAuth.palavraCurta');
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return t('erroAuth.emailInvalido');
  if (m.includes('network') || m.includes('fetch')) return t('erroAuth.semLigacao');
  return msg;
}

/** Resultado de registo: erro, ou aviso de confirmação de email pendente. */
export type ResultadoRegisto = { erro: string } | { confirmarEmail: boolean };

/** Resultado de atualizar perfil: erro, ou confirmação pendente (se mudou o email). */
export type ResultadoPerfil = { erro: string } | { confirmarEmail: boolean };

type AuthContext = {
  sessao: Session | null;
  utilizador: User | null;
  aCarregar: boolean;
  configurado: boolean;
  /** true enquanto o utilizador está a redefinir a palavra-passe (link de email). */
  emRecuperacao: boolean;
  entrar: (email: string, palavra: string) => Promise<string | null>;
  /**
   * Cria a conta. A `intencao` (dono / trabalhador / veterinário) fica no
   * `user_metadata` e só decide o que a app mostra a seguir — ver
   * `data/intencao.ts`. Quem dá acesso a alguma coisa é o servidor.
   */
  registar: (
    email: string,
    palavra: string,
    nome: string,
    intencao?: Intencao,
  ) => Promise<ResultadoRegisto>;
  /** Envia o email com o link de recuperação. Devolve msg de erro ou null. */
  recuperarPalavra: (email: string) => Promise<string | null>;
  /** Define a nova palavra-passe (durante a recuperação). Erro ou null. */
  definirNovaPalavra: (palavra: string) => Promise<string | null>;
  /** Muda nome/email da conta. Se mudou o email, o Supabase pede confirmação. */
  atualizarPerfil: (nome: string, email: string) => Promise<ResultadoPerfil>;
  /**
   * Apaga a conta e tudo o que depende dela, sem volta. Devolve a razão da
   * recusa, ou `null` se ficou apagada.
   *
   * Quem faz o trabalho é a `apagar_a_minha_conta()` do `schema_rgpd.sql` — só
   * ela sabe a ordem certa (libertar os convites resgatados antes de apagar o
   * utilizador) e só ela corre com privilégios para lá chegar. Daqui não se
   * decide nada: o alcance do apagamento está no servidor, não neste ficheiro.
   *
   * Isto NÃO é um `sair()` com mais passos. Quem chama tem de ter perguntado
   * primeiro — ver `data/apagarConta.ts` e o ecrã `conta/apagar`.
   */
  apagarConta: () => Promise<string | null>;
  /**
   * Termina a sessão. Sai sempre do lado de cá, mesmo que o servidor recuse —
   * ver o `fecharSessao` aqui em baixo. Nunca rejeita, e por isso os ecrãs
   * podem chamá-la com `void sair()`.
   */
  sair: () => Promise<void>;

  /* ---- As outras portas de entrada (ver `loginExterno.ts`) ---- */
  /**
   * Entra pelo Google ou pela Apple. Devolve a razão da recusa, ou `null` —
   * incluindo quando a pessoa desiste a meio, que não é erro nenhum e por isso
   * não tem mensagem.
   */
  entrarCom: (metodo: 'google' | 'apple') => Promise<string | null>;
  /** Manda o código de seis dígitos por SMS. O número vem já normalizado. */
  pedirCodigoSms: (telemovel: string) => Promise<string | null>;
  /** Confere o código e abre a sessão. */
  entrarComCodigoSms: (telemovel: string, codigo: string) => Promise<string | null>;

  /* ---- Ligar contas à mesma pessoa (ecrã do Perfil) ---- */
  /** Que formas de entrar esta conta já tem: `email`, `google`, `apple`, `phone`. */
  identidades: () => Promise<{ id: string; provider: string; detalhe?: string }[]>;
  /** Junta mais uma forma de entrar à conta que está aberta. */
  ligarIdentidade: (metodo: 'google' | 'apple') => Promise<string | null>;
  /** Tira uma. O servidor recusa tirar a última — e ainda bem. */
  desligarIdentidade: (id: string) => Promise<string | null>;
};

const Ctx = createContext<AuthContext | null>(null);

/**
 * Fecha a sessão e diz se ela ficou mesmo fechada. Nunca rejeita.
 *
 * Quem chama isto está a SAIR, e sair não pode ficar dependente de uma promessa
 * que vai à rede: o `signOut()` sem `scope` pede ao servidor para revogar o
 * token, e falha sem ligação, com o token já inválido, ou quando o cadeado do
 * auth-js está preso noutro separador. Essa falha chega por duas portas — um
 * `error` na resposta ou uma rejeição — e as duas querem a mesma coisa a
 * seguir, daí serem tratadas aqui como uma só.
 *
 * `scope: 'local'` não vai ao servidor: apaga a sessão deste aparelho e avisa
 * quem está à escuta, que é o que faz o `PortaoAuth` mostrar o ecrã de entrada.
 */
async function fecharSessao(scope?: 'local'): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { error } = scope
      ? await supabase.auth.signOut({ scope })
      : await supabase.auth.signOut();
    return !error;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [emRecuperacao, setEmRecuperacao] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setACarregar(false);
      return;
    }
    /**
     * Toda a sessão entra por aqui, e o dono da cache é conferido ANTES de ela
     * ser publicada. A ordem é a coisa toda: é este `setSessao` que faz o
     * `PortaoAuth` montar o `MembrosProvider` e o `GadoProvider`, e os dois
     * arrancam a ler a cache local. Conferir depois — num efeito, por exemplo —
     * seria conferir com os dados do anterior já no ecrã.
     */
    const aceitarSessao = (nova: Session | null) => {
      if (nova) garantirDono(nova.user.id);
      setSessao(nova);
    };
    supabase.auth.getSession().then(({ data }) => {
      aceitarSessao(data.session);
      setACarregar(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      aceitarSessao(novaSessao);
      // O link de recuperação abre uma sessão especial: mostra o ecrã de nova
      // palavra-passe em vez de entrar direto na app.
      if (evento === 'PASSWORD_RECOVERY') setEmRecuperacao(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const entrar = useCallback(async (email: string, palavra: string) => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: palavra,
    });
    return error ? traduzErro(error.message) : null;
  }, []);

  const registar = useCallback(
    async (
      email: string,
      palavra: string,
      nome: string,
      intencao?: Intencao,
    ): Promise<ResultadoRegisto> => {
      if (!supabase) return { erro: 'Supabase não configurado.' };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: palavra,
        // O `nome` já era lido pelo trigger `handle_new_user` (schema.sql) para
        // a tabela `perfil`. A `intencao` fica só nos metadados: não há coluna
        // nenhuma a lê-la, e nada no servidor decide seja o que for a partir
        // dela.
        options: { data: { nome: nome.trim(), ...(intencao ? { intencao } : {}) } },
      });
      if (error) return { erro: traduzErro(error.message) };
      // Sem sessão imediata => o projeto exige confirmação de email.
      return { confirmarEmail: !data.session };
    },
    [],
  );

  /* ---------------- As outras portas de entrada ---------------- */

  /**
   * Google e Apple, os dois pelo mesmo caminho: o SDK do sistema identifica a
   * pessoa e devolve um token, e o Supabase troca-o por uma sessão.
   *
   * O NOME da Apple só vem à primeira vez (é ela que o decide), por isso grava-se
   * logo — sem isto, quem entrasse pela Apple ficava para sempre com um perfil
   * sem nome e sem forma de o recuperar a não ser escrevê-lo à mão.
   */
  const entrarCom = useCallback(async (metodo: 'google' | 'apple'): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const cred = metodo === 'google' ? await entrarComGoogle() : await entrarComApple();
    // Desistir não é falhar: quem carregou em cancelar não quer ler um aviso.
    if (desistiu(cred)) return null;
    if ('erro' in cred) {
      return cred.erro === 'SEM_MODULO' || cred.erro === 'SEM_CREDENCIAIS'
        ? t('erroAuth.metodoIndisponivel')
        : traduzErro(cred.erro);
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: metodo,
      token: cred.idToken,
    });
    if (error) return traduzErro(error.message);

    if (cred.nome) {
      // A falha aqui não impede a entrada: a sessão já está aberta, e o nome
      // corrige-se no Perfil. Rejeitar agora era fechar a porta a quem acabou
      // de entrar por causa de um campo.
      await supabase.auth.updateUser({ data: { nome: cred.nome } }).catch(() => undefined);
    }
    return null;
  }, []);

  const pedirCodigoSms = useCallback(async (telemovel: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.auth.signInWithOtp({ phone: telemovel });
    return error ? traduzErro(error.message) : null;
  }, []);

  const entrarComCodigoSms = useCallback(
    async (telemovel: string, codigo: string): Promise<string | null> => {
      if (!supabase) return 'Supabase não configurado.';
      const { error } = await supabase.auth.verifyOtp({
        phone: telemovel,
        token: codigo.replace(/\s/g, ''),
        type: 'sms',
      });
      return error ? traduzErro(error.message) : null;
    },
    [],
  );

  /* ---------------- Ligar contas à mesma pessoa ---------------- */

  const identidades = useCallback(async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error || !data) return [];
    return data.identities.map((i) => ({
      id: i.identity_id ?? i.id,
      provider: i.provider,
      // O que distingue esta identidade das outras, para a pessoa a reconhecer:
      // o email da conta Google, o número do telemóvel. A Apple costuma não dar
      // nenhum (o email escondido é dela), e aí fica só o nome do serviço.
      detalhe:
        (i.identity_data?.email as string | undefined) ??
        (i.identity_data?.phone as string | undefined) ??
        undefined,
    }));
  }, []);

  const ligarIdentidade = useCallback(
    async (metodo: 'google' | 'apple'): Promise<string | null> => {
      if (!supabase) return 'Supabase não configurado.';
      const { error } = await supabase.auth.linkIdentity({ provider: metodo });
      return error ? traduzErro(error.message) : null;
    },
    [],
  );

  const desligarIdentidade = useCallback(async (id: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { data } = await supabase.auth.getUserIdentities();
    const alvo = data?.identities.find((i) => (i.identity_id ?? i.id) === id);
    if (!alvo) return t('erroAuth.identidadeNaoEncontrada');
    const { error } = await supabase.auth.unlinkIdentity(alvo);
    return error ? traduzErro(error.message) : null;
  }, []);

  const recuperarPalavra = useCallback(async (email: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    // O link do email abre a página de recuperação no site (funciona em qualquer
    // browser, sem depender de a app estar aberta). Configurável por env.
    const redirectTo = process.env.EXPO_PUBLIC_RESET_URL ?? URL_RECUPERACAO;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return error ? traduzErro(error.message) : null;
  }, []);

  const definirNovaPalavra = useCallback(async (palavra: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.auth.updateUser({ password: palavra });
    if (error) return traduzErro(error.message);
    setEmRecuperacao(false);
    return null;
  }, []);

  /**
   * Atualiza nome e/ou email da conta. Mudar de email não é imediato: o
   * Supabase envia confirmação para o endereço novo e só troca quando o
   * utilizador clicar — daí devolvermos se ficou à espera de confirmação.
   */
  const atualizarPerfil = useCallback(
    async (nome: string, email: string): Promise<ResultadoPerfil> => {
      if (!supabase) return { erro: 'Supabase não configurado.' };
      const emailAtual = sessao?.user.email ?? '';
      const mudouEmail = email.trim().toLowerCase() !== emailAtual.toLowerCase();

      const { error } = await supabase.auth.updateUser({
        data: { nome: nome.trim() },
        ...(mudouEmail ? { email: email.trim() } : {}),
      });
      if (error) return { erro: traduzErro(error.message) };
      return { confirmarEmail: mudouEmail };
    },
    [sessao],
  );

  const apagarConta = useCallback(async (): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.rpc('apagar_a_minha_conta');
    if (error) return traduzErroServidor(error.message);

    // Daqui para baixo já não há conta nenhuma do outro lado, e nada disto pode
    // impedir a app de voltar ao ecrã de entrada.
    //
    // `scope: 'local'` porque o `signOut()` normal pede ao servidor para
    // revogar o token — e o servidor já não tem a quem o revogar. Esse erro
    // deixava a app com a sessão de uma conta apagada no ecrã, que é o pior
    // dos dois mundos: os dados desapareceram e a app continua a agir como se
    // ainda lá estivessem. Pelo `fecharSessao` para nem uma rejeição do
    // armazenamento poder passar à frente do `limparCache()` daqui a duas
    // linhas: o ecrã que chamou isto espera por esta promessa, e uma rejeição
    // deixava-o a rodar para sempre sobre uma conta que já não existe.
    await fecharSessao('local');
    // A cache é a cópia local dos dados que acabaram de ser apagados. Ficar cá
    // era deixar o efetivo de uma exploração que já não existe a servir de
    // primeiro ecrã a quem entrasse a seguir neste aparelho.
    limparCache();
    return null;
  }, []);

  const sair = useCallback(async () => {
    // Revogar o token no servidor é o que se quer quando há rede: a partir daí
    // ele não serve a mais ninguém. Mas é também a única parte disto que
    // depende de fora, e não pode ser ela a decidir se a pessoa sai da conta —
    // sem rede, a falha levava atrás o `limparCache()` e a app ficava na conta
    // depois de se tocar em "Terminar sessão", sem uma palavra a explicar.
    //
    // Falhando, sai-se à mesma pelo caminho de casa (`scope: 'local'`), que é o
    // mesmo recuo do `apagarConta` aqui em cima. O token que ficou por revogar
    // caduca sozinho — e continua a ser revogado sempre que há rede, porque a
    // tentativa normal vem primeiro.
    if (!(await fecharSessao())) await fecharSessao('local');
    // A cache local pertence à conta que saiu. Sem a apagar, o criador seguinte
    // a entrar neste dispositivo veria o efetivo do anterior enquanto o servidor
    // não respondesse (o arranque lê da cache antes de ir à rede).
    limparCache();
  }, []);

  const value = useMemo<AuthContext>(
    () => ({
      sessao,
      utilizador: sessao?.user ?? null,
      aCarregar,
      configurado: supabaseConfigurado,
      emRecuperacao,
      entrar,
      registar,
      recuperarPalavra,
      definirNovaPalavra,
      atualizarPerfil,
      apagarConta,
      sair,
      entrarCom,
      pedirCodigoSms,
      entrarComCodigoSms,
      identidades,
      ligarIdentidade,
      desligarIdentidade,
    }),
    [
      sessao, aCarregar, emRecuperacao, entrar, registar,
      recuperarPalavra, definirNovaPalavra, atualizarPerfil, apagarConta, sair,
      entrarCom, pedirCodigoSms, entrarComCodigoSms,
      identidades, ligarIdentidade, desligarIdentidade,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
