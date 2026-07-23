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
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EcraLogin } from '@/components/EcraLogin';
import { FaixaAmbiente } from '@/components/FaixaAmbiente';
import { LimiteDeErro } from '@/components/LimiteDeErro';
import { EcraNovaPalavra } from '@/components/EcraNovaPalavra';
import { EcraPendente } from '@/components/EcraPendente';
import { AuthProvider, useAuth } from '@/data/auth';
import { MembrosProvider, useMembros } from '@/data/membros';
import { NotificacoesProvider } from '@/data/notificacoes';
import { GadoProvider } from '@/data/store';
import { supabaseConfigurado } from '@/data/supabase';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout } from '@/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Em janelas largas (Electron/browser) a app usa o desenho de desktop — barra
 * lateral e conteúdo em grelha — e ocupa a janela toda. Em janelas de web
 * estreitas mantém-se o desenho de telemóvel, centrado numa coluna, com o
 * fundo a preencher as margens. No telemóvel ocupa a largura toda.
 */
function ColunaApp({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  if (Platform.OS !== 'web') return <>{children}</>;
  if (desktop) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.surfaceSunken }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: layout.colunaMobile,
          backgroundColor: colors.background,
        }}>
        {children}
      </View>
    </View>
  );
}

/**
 * Coluna estreita para os ecrãs de entrada/espera: um formulário curto não
 * ganha nada em esticar por uma janela de desktop, ganha em ficar centrado.
 */
function ColunaEstreita({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  if (!desktop) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.surfaceSunken }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: layout.colunaMobile,
          backgroundColor: colors.background,
        }}>
        {children}
      </View>
    </View>
  );
}

/**
 * Portão de autenticação: com Supabase configurado, exige sessão iniciada
 * (mostra o ecrã de entrada). Sem Supabase, a app segue offline como antes.
 */
function PortaoAuth({ children }: { children: ReactNode }) {
  const { aCarregar, sessao, emRecuperacao } = useAuth();
  if (aCarregar) return null; // mantém o splash até saber se há sessão
  // O link de recuperação abre uma sessão especial — pede a nova palavra-passe
  // antes de deixar entrar na app.
  if (supabaseConfigurado && emRecuperacao)
    return (
      <ColunaEstreita>
        <EcraNovaPalavra />
      </ColunaEstreita>
    );
  if (supabaseConfigurado && !sessao)
    return (
      <ColunaEstreita>
        <EcraLogin />
      </ColunaEstreita>
    );
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
  if (membros.length === 0)
    return (
      <ColunaEstreita>
        <EcraPendente />
      </ColunaEstreita>
    );
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
    // O limite de erro fica por FORA de tudo: se o portão de autenticação, os
    // providers de dados ou qualquer ecrã rebentarem, ainda há quem apanhe.
    <LimiteDeErro>
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Por fora do portão de autenticação: a faixa de testes tem de aparecer
          logo no ecrã de entrada, que é onde se percebe que se está a escrever
          na base errada — antes de lá escrever seja o que for. */}
      <FaixaAmbiente>
      <AuthProvider>
        <ColunaApp>
        <PortaoAuth>
          <MembrosProvider>
            <AppRouter>
              <NotificacoesProvider>
                <GadoProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'slide_from_right',
                  }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(superadmin)" />
                  {/* `alertas` e `financas` mudaram-se para dentro de `(tabs)`
                      (passaram a separadores). O grupo não entra no caminho, por
                      isso os URLs `/alertas` e `/financas` continuam os mesmos —
                      as ligações antigas e a app instalada não partem. */}
                  <Stack.Screen name="animal/[id]" />
                  <Stack.Screen name="animal/novo" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="animal/importar" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="animal/editar/[id]" />
                  <Stack.Screen name="animal/genealogia/[id]" />
                  <Stack.Screen name="evento/novo" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="movimento/novo" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="exploracao/[id]" />
                  <Stack.Screen name="exploracao/nova" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="exploracao/editar/[id]" />
                  <Stack.Screen name="terreno/novo" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="terreno/[id]" />
                  <Stack.Screen name="terreno/editar/[id]" />
                  <Stack.Screen name="terreno/animais/[id]" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="exploracao/equipa/[id]" />
                  <Stack.Screen name="cliente/[id]" />
                  <Stack.Screen name="conta/editar" />
                  <Stack.Screen name="conta/sincronizacao" />
                  <Stack.Screen name="conta/notificacoes" />
                  <Stack.Screen name="conta/financas" />
                  <Stack.Screen name="conta/casa" />
                  <Stack.Screen name="conta/ajuda" />
                  <Stack.Screen name="inspecionar/exploracao/[id]" />
                  <Stack.Screen name="inspecionar/animal/[id]" />
                </Stack>
                </GadoProvider>
              </NotificacoesProvider>
            </AppRouter>
          </MembrosProvider>
        </PortaoAuth>
        </ColunaApp>
      </AuthProvider>
      </FaixaAmbiente>
    </SafeAreaProvider>
    </LimiteDeErro>
  );
}
