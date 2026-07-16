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
import { supabase, supabaseConfigurado } from './supabase';

/** Destino do link de recuperação de palavra-passe (página no site). */
const URL_RECUPERACAO = 'https://gestaogado.netlify.app/recuperar';

/** Traduz as mensagens de erro mais comuns do Supabase para PT-PT. */
function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou palavra-passe incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme o email antes de entrar.';
  if (m.includes('user already registered')) return 'Já existe uma conta com este email.';
  if (m.includes('password should be at least')) return 'A palavra-passe é demasiado curta (mín. 6 caracteres).';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Email inválido.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem ligação à internet. Tente novamente.';
  return msg;
}

/** Resultado de registo: erro, ou aviso de confirmação de email pendente. */
export type ResultadoRegisto = { erro: string } | { confirmarEmail: boolean };

type AuthContext = {
  sessao: Session | null;
  utilizador: User | null;
  aCarregar: boolean;
  configurado: boolean;
  /** true enquanto o utilizador está a redefinir a palavra-passe (link de email). */
  emRecuperacao: boolean;
  entrar: (email: string, palavra: string) => Promise<string | null>;
  registar: (email: string, palavra: string, nome: string) => Promise<ResultadoRegisto>;
  /** Envia o email com o link de recuperação. Devolve msg de erro ou null. */
  recuperarPalavra: (email: string) => Promise<string | null>;
  /** Define a nova palavra-passe (durante a recuperação). Erro ou null. */
  definirNovaPalavra: (palavra: string) => Promise<string | null>;
  /** RGPD: apaga a conta e todos os dados do utilizador. Erro ou null. */
  apagarConta: () => Promise<string | null>;
  sair: () => Promise<void>;
};

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [emRecuperacao, setEmRecuperacao] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setACarregar(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setACarregar(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao);
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
    async (email: string, palavra: string, nome: string): Promise<ResultadoRegisto> => {
      if (!supabase) return { erro: 'Supabase não configurado.' };
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: palavra,
        options: { data: { nome: nome.trim() } },
      });
      if (error) return { erro: traduzErro(error.message) };
      // Sem sessão imediata => o projeto exige confirmação de email.
      return { confirmarEmail: !data.session };
    },
    [],
  );

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

  const apagarConta = useCallback(async (): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.rpc('apagar_a_minha_conta');
    if (error) return traduzErro(error.message);
    // A conta já não existe no servidor — limpa a sessão local e volta ao login.
    await supabase.auth.signOut();
    return null;
  }, []);

  const sair = useCallback(async () => {
    await supabase?.auth.signOut();
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
      apagarConta,
      sair,
    }),
    [
      sessao, aCarregar, emRecuperacao, entrar, registar,
      recuperarPalavra, definirNovaPalavra, apagarConta, sair,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
