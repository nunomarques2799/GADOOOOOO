# Gestão de Gado — contexto para agentes

App móvel de gestão de gado (pecuária) em **React Native (Expo SDK 57)**.
Público-alvo: criadores em Portugal, incluindo utilizadores idosos → **simplicidade
absoluta, PT-PT, offline-first, fontes/botões grandes**. Contexto de produto,
mercado e legal (DGAV/IFAP/SNIRA) em `../Instruções/`.

## Regras do projeto

- **Design system**: usa sempre os tokens de `@/theme` (ver `DESIGN_SYSTEM.md`). Nunca hex soltos.
- **Ícones**: só `MaterialCommunityIcons` via `<Icon name="…" />`. Nunca emojis. Confirma que o nome existe no glyphmap.
- **Texto**: usa `<Text variant="…">` (não `<Text>` do RN diretamente).
- **Idioma**: toda a UI e nomes de domínio em português de Portugal.
- **Dados**: acede via `useGado()` (`src/data/store.tsx`). A UI nunca toca na BD diretamente — os tipos em `src/data/types.ts` espelham o schema Drift para a futura persistência (`expo-sqlite`) entrar sem alterar ecrãs.
- **Offline-first**: com sessão Supabase, a cache local (`src/data/cacheLocal.ts`) é a fonte para a UI e as escritas falhadas por rede ficam numa fila. Assenta em `src/data/armazenamento.ts` — chave-valor **síncrono** (SQLite no telemóvel, `localStorage` na web). Tem de ser síncrono porque o arranque desenha o primeiro ecrã a partir da cache. Nunca voltar a usar `localStorage` diretamente: não existe em React Native e isso deixou o Android sem offline nenhum durante semanas.
- **Navegação**: expo-router. Separadores em `src/app/(tabs)/`, ecrãs de detalhe/formulário empilhados na raiz.
- **Alertas**: só os que não têm prazo a correr (`gravidade: 'info'` **e** sem `diasRestantes`) podem ser calados pelo criador — ver `src/data/dispensados.ts`. Nada com contagem decrescente é silenciável, e uma dispensa cai sozinha se a gravidade piorar. Um alerta que nunca desaparece nem se pode dispensar enche a lista e faz perder os urgentes.
- **Atualizações**: três vias, um só banner (`BannerAtualizacao` → `useAtualizacao()`). Desktop = instalador Electron; telemóvel = **EAS Update** (`eas update --branch preview`), que entrega **só alterações de JS**; web instalada (PWA) = service worker. Mexer em código nativo — plugin novo no `app.json`, permissão, dependência nativa — continua a exigir `eas build`. Na dúvida: se editou `app.json`/`package.json`, é build; se só editou `src/`, chega o update.
- **Web instalável**: a app é publicada num site Netlify próprio e instala-se pelo navegador, sem download nem o aviso "Editor desconhecido" do Windows (ver `website/COMO-PUBLICAR.md`). O HTML da web sai de `public/index.html` — **não** de um `+html.tsx`, que com `web.output: "single"` é ignorado. O service worker (`public/sw.js`) nunca corre dentro do Electron: lá quem atualiza é o electron-updater, e uma cache por cima servia a versão anterior.
- **Notificações**: avisos locais agendados (`expo-notifications`), sem servidor. A decisão do que agendar está em `notificacoesPlano.ts` (lógica pura, testada); `notificacoesLocais.ts` só a executa e tem stub `.web.ts`. Atenção ao teto de 64 notificações pendentes do iOS. Como o `app.json` ganhou o plugin, **a app instalada só passa a notificar depois de um build nativo novo** — não chega publicar.

## Verificar

- `npx tsc --noEmit` **e** `npm test` antes de dar por concluído (é o que a CI corre).
- Pré-visualizar: `npm run web` (localhost:8081) ou Expo Go no telemóvel.
- **Letra ampliada**: a app tem de aguentar o "Tamanho da letra" do Android no máximo. Para testar sem telemóvel, estreitar o viewport do preview para ~258px — equivale a ~1,45× de escala a 375px. Ver `maxFontScale` em `src/theme/tokens.ts`.

## Expo mudou muito

Lê a documentação versionada em https://docs.expo.dev/versions/v57.0.0/ antes de
escrever código que use APIs do Expo. Evita `NativeTabs` (instável, native-only) —
usa o `Tabs` clássico do expo-router para funcionar também na web.
