# Gestão de Gado — app para Windows (Electron)

Embrulha o **build web da app Expo** numa app de computador Windows. O Electron
serve o build web (`web/`) a partir de um servidor HTTP local em `127.0.0.1` e
mostra-o numa janela nativa (ver [`main.js`](main.js)).

## Reconstruir do zero

```bash
# 1. Gerar o build web a partir do projeto Expo
cd ../gestao-gado
npx expo export --platform web         # -> gestao-gado/dist

# 2. Copiar para aqui
cd ../desktop
rm -rf web && cp -r ../gestao-gado/dist web

# 3. Instalar dependências (uma vez)
npm install

# 4. Empacotar (sem assinatura de código)
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win --dir

# 5. Criar o .zip para o site
cd dist-build
mv win-unpacked "Gestao de Gado"
cp ../LEIA-ME.txt "Gestao de Gado/"
../node_modules/7zip-bin/win/x64/7za.exe a -tzip -mx=7 \
  "../../website/downloads/GestaoDeGado-Windows.zip" "Gestao de Gado"
```

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
  permissão de admin: "Cannot create symbolic link"). A app fica não-assinada —
  o Windows mostra o aviso do SmartScreen na 1ª execução (explicado no LEIA-ME).
- **`--dir` + zip manual.** Usamos o target `dir` (só `win-unpacked`) e criamos
  o `.zip` com o `7za`. O target `zip` do electron-builder também aciona o
  `winCodeSign` e o `Compress-Archive` do PowerShell 5.1 gera zips com `\`.
- **Ícone.** `build/icon.png` (512×512) é gerado de `build/icon-source.svg` com
  o `sharp` (`node -e "require('sharp')…"`). O `sharp` está em `devDependencies`
  de propósito, para **não** ser incluído no bundle da app.

## Testar

```bash
npm start                       # corre em modo dev (lê ./web)
```
Ou, depois de empacotar, abrir `dist-build/Gestao de Gado/Gestao de Gado.exe`.
