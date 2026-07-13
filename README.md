# Gestão de Gado 🐄

App móvel para **gestão de explorações pecuárias em Portugal**. Mobile-first,
offline-first, em português de Portugal, com terminologia correta do sector
(exploração, efetivo, vitelo, brinco, SNIRA). Pensada para ser simples ao ponto
de um criador de 82 anos a usar sozinho no campo.

> Reconstrução em **React Native (Expo)** do projeto anteriormente iniciado em
> Flutter. Ver [`../Instruções/`](../Instru%C3%A7%C3%B5es) para o contexto do produto,
> a análise de mercado e o enquadramento legal (DGAV/IFAP/SNIRA).

## Como correr

```bash
npm install

npx expo start           # menu do Metro (escolhe plataforma)
npm run android          # emulador / dispositivo Android
npm run web              # abre no browser (localhost:8081)
```

No telemóvel: instala a app **Expo Go** e lê o QR code que aparece no `expo start`.

> **Nota:** a persistência offline usa **SQLite (`expo-sqlite`)** em iOS/Android.
> No browser (pré-visualização), a app usa dados de exemplo em memória. Para
> instalar no iPhone, ver [`CONSTRUIR_iOS.md`](CONSTRUIR_iOS.md).

## O que está feito (fatia de MVP)

- **Início** — saudação, meteorologia por terreno, alertas de prazos, resumo do efetivo, ações rápidas.
- **Animais** — lista com pesquisa e filtros por espécie; ficha completa do animal com identificação, genealogia (mãe/pai navegável), localização e histórico de eventos.
- **Registar animal** — formulário rápido (chips + data "Hoje" por omissão) desenhado para poucos toques.
- **Explorações** — lista e detalhe (dados oficiais, terrenos, marcador de mapa, animais).
- **Alertas** — prazos legais calculados automaticamente e agrupados por urgência.
- **Perfil** — utilizador, estado offline-first, definições.
- **Registar eventos** — formulários de parto, vacinação, medicamento e pesagem (cálculo de GMD e efeitos nos alertas).
- **Meteorologia real** — Open-Meteo por coordenadas GPS do terreno, com conselho pecuário.
- **Persistência offline** — SQLite (`expo-sqlite`) por trás do `useGado()`; os dados sobrevivem ao fecho da app.
- **Design system** completo — ver [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

Os **alertas legais** são calculados a partir dos dados (identificação até 20
dias, comunicação SNIRA em 7 dias, parto previsto, intervalo de segurança de
medicamento) — ver [`src/data/helpers.ts`](src/data/helpers.ts).

## Estrutura

```
src/
├── app/                    # rotas (expo-router)
│   ├── _layout.tsx         # Stack raiz + fontes + GadoProvider
│   ├── (tabs)/             # Início · Animais · Explorações · Perfil
│   ├── alertas.tsx
│   ├── animal/[id].tsx · animal/novo.tsx
│   └── exploracao/[id].tsx
├── components/
│   ├── ui/                 # primitivas (Button, Card, Chip, Text, Icon…)
│   └── *.tsx               # componentes de domínio (WeatherCard, AnimalRow…)
├── data/                   # types · constants · helpers · seed · store · weather
│   └── db/                 # schema · database · repository (SQLite / expo-sqlite)
└── theme/                  # tokens do design system
```

Arquitetura de dados: `useGado()` (React Context em [`src/data/store.tsx`](src/data/store.tsx))
expõe seletores + CRUD. No nativo persiste em **SQLite** ([`src/data/db/`](src/data/db)),
na web usa dados em memória — os ecrãs falam sempre com `useGado()` e não mudam.
Os tipos em [`src/data/types.ts`](src/data/types.ts) espelham o schema da BD.

## Próximos passos

1. **App no iPhone** — build via EAS Build (ver [`CONSTRUIR_iOS.md`](CONSTRUIR_iOS.md)).
2. **Autenticação** — Supabase Auth (substituir o utilizador fixo `dev-user-001`).
3. **Sincronização cloud** — Supabase (PostgreSQL); a camada [`src/data/db`](src/data/db) já isola o SQL e regista `updatedAt` para preparar isto.
4. **Mapa dos terrenos** — `react-native-maps` com polígonos.
5. **Câmara** — fotografias de animais e explorações.
6. **Nova exploração / novo terreno** — formulários (atualmente só leitura).

## Stack

React Native · Expo SDK 57 · expo-router · expo-sqlite · TypeScript · Nunito · MaterialCommunityIcons.
Preview visual dos ecrãs: publicado como Artifact (ver conversa).
