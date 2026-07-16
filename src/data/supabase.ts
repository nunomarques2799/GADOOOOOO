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
