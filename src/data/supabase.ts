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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** true se as variáveis de ambiente do Supabase estão definidas. */
export const supabaseConfigurado = Boolean(url && chave);

/** Cliente Supabase, ou null se não estiver configurado (app segue offline). */
export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url as string, chave as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
