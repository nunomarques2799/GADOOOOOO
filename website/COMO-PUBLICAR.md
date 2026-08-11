# Publicar e atualizar — como funciona

São **dois projetos do Cloudflare Pages** (plano grátis), a partir deste mesmo
repositório:

| Endereço | O que é | Root directory | Build |
| --- | --- | --- | --- |
| `terrabovina.pt` | A página de apresentação | `website` | nenhum |
| `app.terrabovina.pt` | A app propriamente dita | *(vazia — a raiz)* | `npx expo export --platform web` → `dist` |

Os projetos chamam-se `terrabovina-site` e `terrabovina-app`, e respondem também
nos endereços `*.pages.dev` com esses nomes.

**A *root directory* é o que separa os dois.** É ela que decide o que cada
projeto constrói, e trocá-la põe um projeto a servir o conteúdo do outro. Sinal
de que ficou mal: um build a correr `npx expo export` no site da apresentação.

**Porque não é tudo o mesmo site:** a app tem de ficar na raiz do seu próprio
endereço. O build do Expo referencia tudo por caminhos absolutos (`/_expo/...`)
e numa subpasta (`/app`) não encontraria nada.

**E o endereço da app não deve mudar depois de alguém a instalar.** Uma app
instalada é identificada pelo endereço: os dados offline e a sessão ficam
guardados por origem. Mudar de endereço deixa quem a tinha instalada com uma
app vazia e sem sessão. Foi essa a razão de a mudança de alojamento e a de
domínio se terem feito de uma só vez, em 2026-08-11.

## O que o Cloudflare reconstrói, e quando

Cada `push` para o `main` reconstrói o que lhe disser respeito. Quem decide são
os **Build watch paths** de cada projeto (*Settings* → *Build*), que substituem
a antiga regra `ignore` do Netlify:

| Projeto | Watch paths |
| --- | --- |
| `terrabovina-app` | `src/*`, `public/*`, `assets/*`, `app.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `.node-version` |
| `terrabovina-site` | `website/*` |

Um push que não toque em nenhum deles aparece como **Skipped** — é o esperado,
não é uma avaria. As duas linhas que não se adivinham na lista da app são o
`tsconfig.json` (onde vive o atalho `@/` que o Metro lê) e o `.node-version`
(que fixa o Node 22).

**Não há `_redirects` em lado nenhum, e é de propósito.** No Cloudflare *"os
redirects são sempre seguidos"*: um `/* /index.html 200` engolia o bundle, o
`sw.js` e as fontes. O encaminhamento da app (abrir `/animais` diretamente) e os
URLs sem extensão da apresentação (`/privacidade`, `/termos`, `/recuperar`)
funcionam **sozinhos**. Se um deles der 404, apareceu um `404.html` dentro do
`dist/` — é essa a causa, não falta de configuração.

Os cabeçalhos de cache vêm de `public/_headers` (app) e `website/_headers`
(apresentação). São eles que mantêm o `sw.js` e o `manifest.json` em
`no-cache` — sem isso, a app instalada fica presa numa versão antiga.

## Os dois ambientes

O projeto da app tem variáveis separadas por ambiente (*Settings* → *Variables
and Secrets*), e é isso que impede um build de teste de falar com os dados
reais do criador:

| Ambiente | Quando se aplica | Supabase |
| --- | --- | --- |
| *Production* | branch `main` | produção |
| *Preview* | **todos** os outros branches | testes, com `EXPO_PUBLIC_AMBIENTE=dev` |

O `dev` fica em `dev.terrabovina-app.pages.dev`. O projeto da apresentação não
leva variáveis nenhumas.

> ⚠️ **Sem estas variáveis a app sai em modo demo** — dados de exemplo, sem
> login, e sem nada no ecrã a explicar porquê. É o primeiro sintoma a
> reconhecer se um build parecer "vazio".

## O que o utilizador vê

Abre o site, carrega em **Abrir no computador** e a app abre já a funcionar no
navegador. Se carregar em **Instalar** na barra de endereços, fica com ícone no
ambiente de trabalho e abre em janela própria, sem barra de endereço — igual a
um programa instalado.

**Não aparece nenhum aviso do Windows.** Esse aviso ("Editor desconhecido") é
do instalador `.exe`, que continua disponível como alternativa mais abaixo na
página, e só desaparecia com um certificado de assinatura de código — centenas
de euros por ano.

Depois de instalada, a app **abre sem rede**: o `public/sw.js` guarda uma cópia
local. As atualizações chegam sozinhas e são anunciadas pelo mesmo banner
"Atualizar agora" que já existe no Windows e no telemóvel.

## A app Windows (automático)

O download **não vive no site** — vive no **GitHub Releases** e é reconstruído
sozinho. O botão do site aponta sempre para:

```
https://github.com/nunomarques2799/GADOOOOOO/releases/latest/download/GestaoDeGado-Setup.exe
```

`latest/download/` e um nome de ficheiro FIXO, de propósito: cada publicação cria
um Release novo (`1.0.<número do build>`) e este link resolve sempre para o mais
recente, sem nunca precisar de ser mexido. O ZIP portátil que aqui esteve foi
abandonado — o `electron-updater` não sabe atualizar a partir de um ZIP no
Windows, e sem instalador não havia auto-update nenhum.

### O que acontece quando mudas a app

1. Fazes as tuas alterações no código da app.
2. Fazes **commit + push** para o `main` no GitHub.
3. O GitHub Actions (`.github/workflows/build-windows.yml`) corre sozinho:
   gera o build web → empacota a app Windows → constrói o instalador NSIS →
   publica-o num Release novo `1.0.<número do build>`, com o `latest.yml` que o
   auto-update lê.
4. O link do site passa a servir a versão nova **automaticamente**, e quem já a
   tem instalada recebe o banner "Atualizar agora".

➡️ **Não voltas a tocar no site nem a gerar ZIPs à mão.**

### Ver / correr à mão

- Progresso dos builds: separador **Actions** do repositório no GitHub.
- Também podes correr à mão em *Actions → Build Windows app → Run workflow*.

> ⚠️ A automação usa o código que está **no GitHub**. Uma alteração só entra na
> app depois de fazeres `push` — o que tens por committar localmente ainda não
> conta até ser enviado.

## Notas

- **Custo:** o plano grátis do Cloudflare dá 500 builds/mês e largura de banda
  sem limite. O build do Windows corre no GitHub Actions (grátis e ilimitado em
  repositório público) e o download é servido pelo GitHub.
- **Os `netlify.toml` ainda cá estão** e são o caminho de recuo: enquanto os
  sites `netlify.app` existirem, voltar atrás é apontar o DNS. Só se apagam
  depois de umas semanas sem sobressaltos — ver
  [`../MIGRAR_CLOUDFLARE.md`](../MIGRAR_CLOUDFLARE.md).
- **Reconstruir localmente** (opcional): ver [`../desktop/README.md`](../desktop/README.md).
