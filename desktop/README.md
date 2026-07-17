# Gestão de Gado — app para Windows (Electron)

Embrulha o **build web da app Expo** numa app de computador Windows. O Electron
serve o build web (`web/`) a partir de um servidor HTTP local em `127.0.0.1` e
mostra-o numa janela nativa (ver [`main.js`](main.js)).

Distribui-se como **instalador NSIS** que se atualiza sozinho. Quem publica é o
CI ([`build-windows.yml`](../.github/workflows/build-windows.yml)) — não é preciso
construir nem enviar nada à mão.

## Como funciona a atualização automática

1. O CI dá à app a versão `1.0.<run_number>` (tem de subir sempre, senão o
   updater não vê o build como mais recente) e publica no Release `v1.0.<n>` o
   instalador **e o `latest.yml`**.
2. A app instalada lê o `latest.yml` do Release mais recente, compara versões e
   descarrega o instalador em fundo (`electron-updater`, ver `main.js`).
3. Quando acaba, avisa a app pelo `preload.js` → aparece o banner → o clique em
   "Atualizar agora" chama `quitAndInstall`, que instala e reabre a app.

O site aponta para `releases/latest/download/GestaoDeGado-Setup.exe`: como o nome
do ficheiro é fixo, o link nunca precisa de ser mudado.

## Reconstruir do zero (local)

```bash
# 1. Gerar o build web a partir do projeto Expo
cd ../gestao-gado
npx expo export --platform web         # -> gestao-gado/dist

# 2. Copiar para aqui
cd ../desktop
rm -rf web && cp -r ../gestao-gado/dist web

# 3. Instalar dependências (uma vez)
npm install

# 4. Empacotar sem publicar (sem assinatura de código)
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win --x64 --publish never
```

O instalador fica em `dist-build/GestaoDeGado-Setup.exe`. Em builds locais a
atualização automática não corre (`app.isPackaged` é falso em `npm start`, e um
instalador local não tem Release com que se comparar).

## Gotchas importantes

- **Fontes / ícones via `extraResources`, não `asar`.** As fontes da app
  (Nunito e o *glyph font* dos `MaterialCommunityIcons`) são exportadas para
  `web/assets/node_modules/…`. O `electron-builder` filtra pastas `node_modules`
  ao construir o `app.asar`, o que **descartava os `.ttf`** e partia os ícones.
  Por isso o `web/` é copiado inteiro via `extraResources` (`package.json`) e o
  `main.js` lê de `process.resourcesPath/web` quando empacotado. Não voltar a
  meter `web/**/*` em `files`.
- **Sem assinatura de código.** `CSC_IDENTITY_AUTO_DISCOVERY=false` evita que o
  `electron-builder` tente descarregar/extrair o `winCodeSign` (que falha sem
  permissão de admin: "Cannot create symbolic link" — daí o target `dir` que se
  usava antes). No runner do CI há permissões, e o `nsis` constrói sem problema.
  A app fica não-assinada: o Windows mostra o aviso do SmartScreen na 1ª
  instalação ("Mais informações" → "Executar mesmo assim").
- **A publicação tem de ser do `electron-builder`** (`--publish always`), não um
  upload à mão do ficheiro. É ele que gera e envia o `latest.yml`; sem esse
  ficheiro no Release, as apps instaladas deixam de se atualizar em silêncio.
- **O `preload.js` tem de estar em `files`.** Sem ele o banner de atualização
  nunca aparece (a ponte `window.gadoAtualizacao` não existe) — e não há erro
  visível, a app só fica calada.
- **Ícone.** `build/icon.png` (512×512) é gerado de `build/icon-source.svg` com
  o `sharp` (`node -e "require('sharp')…"`). O `sharp` está em `devDependencies`
  de propósito, para **não** ser incluído no bundle da app.

## Testar

```bash
npm start                       # corre em modo dev (lê ./web)
```
Ou, depois de empacotar, correr `dist-build/GestaoDeGado-Setup.exe`.
