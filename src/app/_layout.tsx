import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Abertura, aberturaVaiCorrer } from '@/components/Abertura';
import { AberturaPorAviso } from '@/components/AberturaPorAviso';
import { AnfitriaoAvisos } from '@/components/AnfitriaoAvisos';
import { AnfitriaoMensagens } from '@/components/AnfitriaoMensagens';
import { AnfitriaoToasts } from '@/components/AnfitriaoToasts';
import { ComBarraLateral } from '@/components/BarraLateralDaApp';
import { EcraACarregar } from '@/components/EcraACarregar';
import { EntradaEcra, type ModoEntrada } from '@/components/EntradaEcra';
import { EcraLogin } from '@/components/EcraLogin';
import { FaixaAmbiente } from '@/components/FaixaAmbiente';
import { IndicadorAtualizar } from '@/components/IndicadorAtualizar';
import { LimiteDeErro } from '@/components/LimiteDeErro';
import { EcraNovaPalavra } from '@/components/EcraNovaPalavra';
import { EcraPendente } from '@/components/EcraPendente';
import { AgendadorAvisos } from '@/components/AgendadorAvisos';
import { DURACAO, semMovimento } from '@/components/ui/movimento';
import { CamadaVoo } from '@/components/VooAnimal';
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
  // O fundo de fora é o MESMO creme de dentro: com o tom de areia dos lados,
  // a coluna lia-se como a app de telemóvel aberta numa tira ao meio do
  // monitor. Assim é uma página com o conteúdo ao centro.
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background }}>
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
  // Na moldura da entrada, como o login (ver `EcraLoginDesktop`).
  if (supabaseConfigurado && emRecuperacao) return <EcraNovaPalavra />;
  // O login ocupa a janela toda: no computador tem um desenho próprio, com a
  // marca de um lado e o formulário do outro (ver `EcraLoginDesktop`). Numa
  // coluna estreita ao meio do monitor parecia a app com a janela mal esticada.
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


/**
 * Os ecrãs que se PREENCHEM e fecham: sobem de baixo, como uma folha. Os que
 * se LEEM (fichas, listas, definições) entram pela direita. O gesto diz o que o
 * ecrã é antes de se ler o título.
 */
const FORMULARIOS = new Set([
  'animal/novo',
  'animal/importar',
  'animal/editar/[id]',
  'evento/novo',
  'movimento/novo',
  'movimento/editar/[id]',
  'exploracao/nova',
  'exploracao/editar/[id]',
  'terreno/novo',
  'terreno/editar/[id]',
  'terreno/animais/[id]',
  'medicamento/novo',
  'medicamento/editar/[id]',
  'agenda/novo',
  'agenda/editar/[id]',
  'conta/editar',
]);

/** Como um ecrã entra (ver `EntradaEcra.tsx`). */
function modoEntrada(route: { name: string; params?: object }): ModoEntrada {
  if (route.name === '(tabs)' || route.name === '(superadmin)') return 'nenhum';
  if (FORMULARIOS.has(route.name)) return 'baixo';
  // A ficha aberta da lista de animais: quem se mexe é o retrato a voar para o
  // sítio dele (ver `VooAnimal.tsx`), e o ecrã só aparece por baixo.
  if ((route.params as { voo?: string } | undefined)?.voo) return 'fade';
  return 'direita';
}

/** O mesmo, no telemóvel, onde é a pilha nativa que anima. */
function animacaoNativa(route: { name: string; params?: object }) {
  if (semMovimento()) return 'none' as const;
  const modo = modoEntrada(route);
  if (modo === 'baixo') return 'slide_from_bottom' as const;
  if (modo === 'fade') return 'fade' as const;
  return 'slide_from_right' as const;
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
   * publica-os. Cada família leva a sua licença ao lado (`*-LICENSE.txt`).
   *
   * Desde 2026-10-02 (a marca nova) são três: Atkinson Hyperlegible Next no
   * texto, Fraunces nos títulos e IBM Plex Mono nos números. O Fraunces vem em
   * duas instâncias fixas (ótica 34 e 20, eixo SOFT a 100), tiradas do Google
   * Fonts: o React Native não mexe nos eixos de uma letra variável. Ver
   * `fontFamily` em `src/theme/tokens.ts`.
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
    AtkinsonHyperlegibleNext_400Regular: require('../../assets/fontes/AtkinsonHyperlegibleNext_400Regular.ttf'),
    AtkinsonHyperlegibleNext_500Medium: require('../../assets/fontes/AtkinsonHyperlegibleNext_500Medium.ttf'),
    AtkinsonHyperlegibleNext_600SemiBold: require('../../assets/fontes/AtkinsonHyperlegibleNext_600SemiBold.ttf'),
    AtkinsonHyperlegibleNext_700Bold: require('../../assets/fontes/AtkinsonHyperlegibleNext_700Bold.ttf'),
    Fraunces_600SemiBold_opsz34: require('../../assets/fontes/Fraunces_600SemiBold_opsz34.ttf'),
    Fraunces_600SemiBold_opsz20: require('../../assets/fontes/Fraunces_600SemiBold_opsz20.ttf'),
    IBMPlexMono_500Medium: require('../../assets/fontes/IBMPlexMono_500Medium.ttf'),
    IBMPlexMono_600SemiBold: require('../../assets/fontes/IBMPlexMono_600SemiBold.ttf'),
    'material-community': require('../../assets/fontes/MaterialCommunityIcons.ttf'),
  });

  // Uma fonte que não carrega NÃO PODE valer uma app que não abre. Foi o que
  // aconteceu enquanto isto era só `if (!loaded)`: os ficheiros deixaram de ser
  // servidos e a app deixou de ter ecrã, sem nada escrito em lado nenhum. Com
  // o erro a contar como "já não vale a pena esperar", o pior caso passa a ser
  // a app inteira desenhada com a letra do sistema.
  const podeDesenhar = fontesProntas || erroFontes != null;

  useEffect(() => {
    // Com a abertura a correr, é ela que esconde o ecrã do sistema, quando as
    // camadas do logótipo estiverem carregadas (ver `Abertura.tsx`).
    if (!podeDesenhar) return;
    if (!aberturaVaiCorrer()) {
      SplashScreen.hideAsync();
      return;
    }
    // A rede de segurança: se a abertura não chegar a esconder o ecrã (falhou
    // ao desenhar, por exemplo), esconde-se aqui à mesma. Uma app presa no
    // logótipo fixo é pior do que uma abertura que não correu.
    const t = setTimeout(() => void SplashScreen.hideAsync().catch(() => undefined), 1500);
    return () => clearTimeout(t);
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
                {/* No computador, a barra lateral à volta da pilha toda: fica
                    à vista também nas fichas e nos formulários. */}
                <ComBarraLateral>
                <Stack
                  screenOptions={({ route }) => ({
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: animacaoNativa(route),
                    animationDuration: DURACAO.ecraNativo,
                  })}
                  screenLayout={({ route, children }) => (
                    <EntradaEcra modo={modoEntrada(route)}>{children}</EntradaEcra>
                  )}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(superadmin)" />
                  {/* `alertas` e `financas` mudaram-se para dentro de `(tabs)`
                      (passaram a separadores). O grupo não entra no caminho, por
                      isso os URLs `/alertas` e `/financas` continuam os mesmos —
                      as ligações antigas e a app instalada não partem. */}
                  <Stack.Screen name="animal/[id]" />
                  <Stack.Screen name="animal/novo" />
                  <Stack.Screen name="animal/importar" />
                  <Stack.Screen name="animal/editar/[id]" />
                  <Stack.Screen name="animal/genealogia/[id]" />
                  <Stack.Screen name="evento/novo" />
                  <Stack.Screen name="movimento/novo" />
                  <Stack.Screen name="exploracao/[id]" />
                  <Stack.Screen name="exploracao/nova" />
                  <Stack.Screen name="exploracao/editar/[id]" />
                  <Stack.Screen name="terreno/novo" />
                  <Stack.Screen name="terreno/[id]" />
                  <Stack.Screen name="terreno/editar/[id]" />
                  <Stack.Screen name="terreno/animais/[id]" />
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
                  <Stack.Screen name="conta/barra" />
                  <Stack.Screen name="conta/ajuda" />
                  <Stack.Screen name="conta/apagar" />
                  <Stack.Screen name="inspecionar/exploracao/[id]" />
                  <Stack.Screen name="inspecionar/animal/[id]" />
                </Stack>
                </ComBarraLateral>
                {/* Por cima de toda a navegação: o retrato que voa da lista de
                    animais para a ficha. Não apanha toques. */}
                <CamadaVoo />
                </GadoProvider>
              </NotificacoesProvider>
            </AppRouter>
          </MembrosProvider>
        </PortaoAuth>
        </ColunaApp>
      </AuthProvider>
      </ToastsProvider>
      </FaixaAmbiente>
      {/* Por cima de tudo, à frente da faixa e dos avisos: o logótipo com o
          arco dourado quando se puxa para atualizar, e a abertura com as
          espigas a crescer, que só corre uma vez, ao abrir a app. */}
      <IndicadorAtualizar />
      <Abertura />
    </SafeAreaProvider>
    </LimiteDeErro>
  );
}
