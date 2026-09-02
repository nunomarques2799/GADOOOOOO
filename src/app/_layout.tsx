import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AberturaPorAviso } from '@/components/AberturaPorAviso';
import { AnfitriaoAvisos } from '@/components/AnfitriaoAvisos';
import { AnfitriaoMensagens } from '@/components/AnfitriaoMensagens';
import { AnfitriaoToasts } from '@/components/AnfitriaoToasts';
import { EcraACarregar } from '@/components/EcraACarregar';
import { EcraLogin } from '@/components/EcraLogin';
import { FaixaAmbiente } from '@/components/FaixaAmbiente';
import { LimiteDeErro } from '@/components/LimiteDeErro';
import { EcraNovaPalavra } from '@/components/EcraNovaPalavra';
import { EcraPendente } from '@/components/EcraPendente';
import { AgendadorAvisos } from '@/components/AgendadorAvisos';
import { AuthProvider, useAuth } from '@/data/auth';
import { MembrosProvider, useMembros } from '@/data/membros';
import { NotificacoesProvider } from '@/data/notificacoes';
import { usePaletaDaConta } from '@/data/paletaConta';
import { GadoProvider } from '@/data/store';
import { ToastsProvider } from '@/data/toasts';
import { supabaseConfigurado } from '@/data/supabase';
import { useDesktop } from '@/hooks/useDesktop';
import { arrancarIdioma } from '@/i18n';
import { colors, layout } from '@/theme';
import { arrancarTema, temaEscuro } from '@/theme/preferencia';

SplashScreen.preventAutoHideAsync();

// Antes de qualquer ecrã se desenhar. O armazenamento é síncrono de propósito
// (ver `armazenamento.ts`), o que permite a app abrir já na paleta escolhida em
// vez de piscar do verde para a cor certa à frente do criador.
arrancarTema();
// Pela mesma razão e no mesmo momento: sem isto o primeiro ecrã saía em
// português e trocava de língua à frente de quem escolheu inglês.
arrancarIdioma();

/**
 * Em janelas largas (Electron/browser) a app usa o desenho de desktop — barra
 * lateral e conteúdo em grelha — e ocupa a janela toda. Em janelas de web
 * estreitas mantém-se o desenho de telemóvel, centrado numa coluna, com o
 * fundo a preencher as margens. No telemóvel ocupa a largura toda.
 */
function ColunaApp({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  if (Platform.OS !== 'web') return <ComToasts>{children}</ComToasts>;
  if (desktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ComToasts>{children}</ComToasts>
      </View>
    );
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
        <ComToasts>{children}</ComToasts>
      </View>
    </View>
  );
}

/**
 * A camada onde os avisos curtos aparecem, por cima de qualquer ecrã.
 *
 * Fica DENTRO da coluna da app (e não no topo da árvore) para o aviso nascer
 * alinhado com o conteúdo: numa janela larga de browser, a app vive numa coluna
 * estreita ao meio e um cartão ancorado à janela aparecia-lhe ao lado.
 */
function ComToasts({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      {children}
      <AnfitriaoToasts />
      {/* As perguntas e os avisos que interrompem. Aqui pela mesma razão dos
          toasts — quem os manda quase sempre fecha o ecrã a seguir — e por
          cima de tudo, que é onde uma pergunta sem volta tem de estar. */}
      <AnfitriaoAvisos />
    </View>
  );
}

/**
 * Coluna estreita para os ecrãs de entrada/espera: um formulário curto não
 * ganha nada em esticar por uma janela de desktop, ganha em ficar centrado.
 *
 * O ecrã de acesso (`EcraPendente`) pede mais largura — tem escolhas lado a
 * lado e um formulário de quatro campos —, daí o `largura`. Apertado nos 560
 * de um telemóvel, aquilo era uma tira de botões empilhados no meio de um
 * monitor vazio.
 */
function ColunaEstreita({
  children,
  largura = layout.colunaMobile,
}: {
  children: ReactNode;
  largura?: number;
}) {
  const desktop = useDesktop();
  if (!desktop) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.surfaceSunken }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: largura,
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
  // A paleta escolhida noutro aparelho chega com a sessão. Aqui porque é o
  // primeiro sítio dentro do `AuthProvider` que está sempre montado — e antes
  // de qualquer ecrã da app, para as cores não trocarem à frente de quem já
  // está a trabalhar.
  usePaletaDaConta();
  // O `EcraACarregar` só aparece passado quase um segundo, por isso um arranque
  // normal continua a ser o splash a dar lugar à app, sem nada pelo meio.
  if (aCarregar)
    return (
      <ColunaEstreita>
        <EcraACarregar />
      </ColunaEstreita>
    );
  // O link de recuperação abre uma sessão especial — pede a nova palavra-passe
  // antes de deixar entrar na app.
  if (supabaseConfigurado && emRecuperacao)
    return (
      <ColunaEstreita>
        <EcraNovaPalavra />
      </ColunaEstreita>
    );
  // O login pede mais largura do que os 560 de um telemóvel: num monitor, uma
  // tira estreita encostada ao topo com dois campos lá dentro parece a app
  // aberta com a janela mal esticada. `EcraLogin` centra-se dentro dela.
  if (supabaseConfigurado && !sessao)
    return (
      <ColunaEstreita largura={layout.conteudoEstreito}>
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
  // Sem a cache do último acesso — primeira vez, ou depois de a app mudar de
  // pasta de dados — isto espera pelo servidor. Era o segundo sítio onde a app
  // ficava em branco à espera de uma resposta que podia nunca chegar.
  if (aCarregar)
    return (
      <ColunaEstreita>
        <EcraACarregar mensagem="A carregar as suas explorações…" />
      </ColunaEstreita>
    );
  if (isSuperadmin) return <>{children}</>;
  if (membros.length === 0)
    return (
      <ColunaEstreita largura={layout.conteudoEstreito}>
        <EcraPendente />
      </ColunaEstreita>
    );
  return <>{children}</>;
}

export default function RootLayout() {
  /*
   * AS FONTES SÃO FICHEIROS NOSSOS, e não os módulos do pacote.
   * ------------------------------------------------------------------
   * Isto era `useFonts({ Nunito_400Regular, ... })` com os módulos do
   * `@expo-google-fonts/nunito`, e o ícone trazia o ttf de dentro do
   * `@expo/vector-icons`. Funciona em todo o lado menos onde a app vive: o
   * Cloudflare Pages NÃO PUBLICA nada que esteja numa pasta `node_modules`, e
   * o `expo export` escreve esses ficheiros exatamente em
   * `dist/assets/node_modules/...`. Em produção os pedidos das fontes
   * devolviam o index.html (o Pages serve a SPA a tudo o que não encontra), o
   * navegador rejeitava-os ("invalid sfntVersion", que em hexadecimal é
   * `<!DO`), e a app ficava um ecrã BRANCO por causa do `return null` abaixo.
   *
   * Com os ficheiros em `assets/fontes/` o caminho exportado passa a ser
   * `/assets/assets/fontes/...`, sem `node_modules` pelo meio, e o Pages
   * publica-os. O pacote fica instalado na mesma: é de lá que estas cópias
   * saíram (`assets/fontes/Nunito-LICENSE.txt` é a licença que as acompanha).
   *
   * A fonte dos ÍCONES está aqui pela mesma razão, e resolve-se por ordem de
   * chegada: o `@expo/vector-icons` só carrega o ttf dele quando o primeiro
   * ícone se desenha, e pergunta antes por `Font.isLoaded()`. Como nada se
   * desenha antes destas fontes estarem prontas, quem regista a família é esta
   * linha, com o nosso ficheiro.
   *
   * O nome tem de ser `material-community` e não `MaterialCommunityIcons`: é
   * a string que o pacote passa ao `createIconSet` (ver
   * `@expo/vector-icons/build/MaterialCommunityIcons.js`) e é por ela que ele
   * pergunta. Registada com o nome do ficheiro, a família ficava carregada mas
   * ninguém a usava, e os ícones continuavam a vir do `node_modules`.
   */
  const [fontesProntas, erroFontes] = useFonts({
    Nunito_400Regular: require('../../assets/fontes/Nunito_400Regular.ttf'),
    Nunito_500Medium: require('../../assets/fontes/Nunito_500Medium.ttf'),
    Nunito_600SemiBold: require('../../assets/fontes/Nunito_600SemiBold.ttf'),
    Nunito_700Bold: require('../../assets/fontes/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold: require('../../assets/fontes/Nunito_800ExtraBold.ttf'),
    'material-community': require('../../assets/fontes/MaterialCommunityIcons.ttf'),
  });

  // Uma fonte que não carrega NÃO PODE valer uma app que não abre. Foi o que
  // aconteceu enquanto isto era só `if (!loaded)`: os ficheiros deixaram de ser
  // servidos e a app deixou de ter ecrã, sem nada escrito em lado nenhum. Com
  // o erro a contar como "já não vale a pena esperar", o pior caso passa a ser
  // a app inteira desenhada com a letra do sistema.
  const podeDesenhar = fontesProntas || erroFontes != null;

  useEffect(() => {
    if (podeDesenhar) SplashScreen.hideAsync();
  }, [podeDesenhar]);

  if (!podeDesenhar) return null;

  return (
    // O limite de erro fica por FORA de tudo: se o portão de autenticação, os
    // providers de dados ou qualquer ecrã rebentarem, ainda há quem apanhe.
    <LimiteDeErro>
    <SafeAreaProvider>
      {/* Fundo claro → ícones escuros; paleta Noite → ícones claros. */}
      <StatusBar style={temaEscuro() ? 'light' : 'dark'} />
      {/* Por fora do portão de autenticação: a faixa de testes tem de aparecer
          logo no ecrã de entrada, que é onde se percebe que se está a escrever
          na base errada — antes de lá escrever seja o que for. */}
      <FaixaAmbiente>
      {/* Por fora de tudo o que grava: um aviso de "gravado" tem de sobreviver
          ao ecrã que o mandou, que quase sempre se fecha logo a seguir. */}
      <ToastsProvider>
      <AuthProvider>
        <ColunaApp>
        <PortaoAuth>
          <MembrosProvider>
            <AppRouter>
              <NotificacoesProvider>
                <GadoProvider>
                {/* Dentro do GadoProvider (precisa de saber se o animal do
                    aviso ainda existe) e ao lado da navegação (é ela que ele
                    manda para a ficha). Não desenha nada. */}
                <AberturaPorAviso />
                {/* Quem agenda os avisos no telemóvel: prazos do efetivo e o
                    fim do acesso. Aqui dentro porque precisa dos três
                    contextos ao mesmo tempo — ver o cabeçalho dele. */}
                <AgendadorAvisos />
                {/* Abre a subscrição de tempo real das conversas (é ela que
                    acende o número na barra de baixo) e mostra o aviso curto
                    da mensagem que chega com a app aberta. */}
                <AnfitriaoMensagens />
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
                  <Stack.Screen name="equipa/historico" />
                  <Stack.Screen name="chat/[id]" />
                  <Stack.Screen name="chat/info/[id]" />
                  <Stack.Screen name="chat/ajustes" />
                  <Stack.Screen name="atividade" />
                  <Stack.Screen name="cliente/[id]" />
                  <Stack.Screen name="conta/editar" />
                  <Stack.Screen name="conta/sincronizacao" />
                  <Stack.Screen name="conta/notificacoes" />
                  <Stack.Screen name="conta/financas" />
                  <Stack.Screen name="conta/existencias" />
                  <Stack.Screen name="conta/aparencia" />
                  <Stack.Screen name="conta/idioma" />
                  <Stack.Screen name="conta/ajuda" />
                  <Stack.Screen name="conta/apagar" />
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
      </ToastsProvider>
      </FaixaAmbiente>
    </SafeAreaProvider>
    </LimiteDeErro>
  );
}
