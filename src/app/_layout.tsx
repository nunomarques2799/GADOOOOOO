import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EcraLogin } from '@/components/EcraLogin';
import { EcraPendente } from '@/components/EcraPendente';
import { AuthProvider, useAuth } from '@/data/auth';
import { MembrosProvider, useMembros } from '@/data/membros';
import { GadoProvider } from '@/data/store';
import { supabaseConfigurado } from '@/data/supabase';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Portão de autenticação: com Supabase configurado, exige sessão iniciada
 * (mostra o ecrã de entrada). Sem Supabase, a app segue offline como antes.
 */
function PortaoAuth({ children }: { children: ReactNode }) {
  const { aCarregar, sessao } = useAuth();
  if (aCarregar) return null; // mantém o splash até saber se há sessão
  if (supabaseConfigurado && !sessao) return <EcraLogin />;
  return <>{children}</>;
}

/**
 * Escolhe qual "app" mostrar: superadmin (painel comercial) vs. cliente
 * (gestão de gado). Superadmin não vê animais/explorações — vê clientes.
 * Um utilizador autenticado sem role vê o ecrã "aguarda aprovação".
 */
function AppRouter({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const { aCarregar, membros, isSuperadmin } = useMembros();
  if (!supabaseConfigurado || !sessao) return <>{children}</>;
  if (aCarregar) return null;
  if (isSuperadmin) return <>{children}</>;
  if (membros.length === 0) return <EcraPendente />;
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <PortaoAuth>
          <MembrosProvider>
            <AppRouter>
              <GadoProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'slide_from_right',
                  }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(superadmin)" />
                  <Stack.Screen name="alertas" />
                  <Stack.Screen name="animal/[id]" />
                  <Stack.Screen name="animal/novo" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="evento/novo" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="exploracao/[id]" />
                  <Stack.Screen name="exploracao/nova" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="exploracao/editar/[id]" />
                  <Stack.Screen name="terreno/novo" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="terreno/[id]" />
                  <Stack.Screen name="exploracao/equipa/[id]" />
                  <Stack.Screen name="cliente/[id]" />
                  <Stack.Screen name="inspecionar/exploracao/[id]" />
                  <Stack.Screen name="inspecionar/animal/[id]" />
                </Stack>
              </GadoProvider>
            </AppRouter>
          </MembrosProvider>
        </PortaoAuth>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
