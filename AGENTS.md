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
- **Navegação**: expo-router. Separadores em `src/app/(tabs)/`, ecrãs de detalhe/formulário empilhados na raiz.

## Verificar

- `npx tsc --noEmit` antes de dar por concluído (apanha nomes de ícones inválidos, imports, etc.).
- Pré-visualizar: `npm run web` (localhost:8081) ou Expo Go no telemóvel.

## Expo mudou muito

Lê a documentação versionada em https://docs.expo.dev/versions/v57.0.0/ antes de
escrever código que use APIs do Expo. Evita `NativeTabs` (instável, native-only) —
usa o `Tabs` clássico do expo-router para funcionar também na web.
