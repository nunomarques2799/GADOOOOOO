/**
 * Cliente Supabase (cloud).
 * ------------------------------------------------------------------
 * A app é offline-first: funciona sem Supabase. Este cliente serve a
 * autenticação e a sincronização/backup na cloud. A chave usada é a
 * PUBLISHABLE (segura para o cliente, protegida por Row Level Security);
 * vem de variáveis EXPO_PUBLIC_* (ver .env.example).
 *
 * A sessão é guardada em AsyncStorage, para o utilizador se manter
 * autenticado entre arranques (e entrar offline após o 1.º login).
 */

import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// Na web/Electron, o link de recuperação de palavra-passe traz o token no
// fragmento da URL — é preciso deixar o Supabase detetá-lo para abrir a sessão
// de recuperação. No nativo isso vem por deep-link, por isso fica desligado.
const detetarSessaoNaUrl = Platform.OS === 'web';

/** true se as variáveis de ambiente do Supabase estão definidas. */
export const supabaseConfigurado = Boolean(url && chave);

/** Cliente Supabase, ou null se não estiver configurado (app segue offline). */
export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url as string, chave as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: detetarSessaoNaUrl,
        // `implicit`: os links de email (recuperação/confirmação) trazem o token
        // no fragmento da URL, por isso abrem em QUALQUER browser — mesmo o do
        // telemóvel a abrir a página de recuperação no site. Com `pkce` (default)
        // o link só funcionaria no mesmo dispositivo que o pediu.
        flowType: 'implicit',
      },
    })
  : null;

/**
 * Só no ambiente de TESTES: deixa o cliente à mão na consola do navegador,
 * como `window.gado`.
 *
 * Existe por causa dos erros que só se percebem do lado de quem faz o pedido.
 * A app mostra a `message` do erro; o Postgres manda também `code`, `details` e
 * `hint`, e é aí que costuma estar a resposta ("42501" = a RLS recusou vs.
 * "PGRST204" = a API não conhece a coluna). Reproduzir na consola dá o objeto
 * inteiro, e com a MESMA sessão que a app usa — que é a diferença entre isto e
 * repetir o comando no SQL Editor, onde se corre como `postgres` e a RLS nem
 * chega a ser avaliada.
 *
 *   await gado.auth.getSession()               // quem é que a app diz que sou
 *   await gado.from('exploracao').insert({…})  // erro completo, não só a frase
 *
 * Fora do `dev` não é definido: em produção seria uma consola aberta sobre a
 * base de dados de quem usa a app a sério.
 */
if (supabase && process.env.EXPO_PUBLIC_AMBIENTE === 'dev') {
  (globalThis as { gado?: SupabaseClient }).gado = supabase;
}
