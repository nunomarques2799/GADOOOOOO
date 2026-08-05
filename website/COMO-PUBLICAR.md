# Publicar e atualizar — como funciona

São **dois sites Netlify** (ambos no plano grátis), a partir deste mesmo
repositório:

| Site | O que é | Base directory | Que ficheiro o configura |
| --- | --- | --- | --- |
| `gestaogado.netlify.app` | A página de apresentação | `website` | `website/netlify.toml` |
| `app-gestaogado.netlify.app` | A app propriamente dita | *(vazia)* | `netlify.toml` (na raiz) |

**A *base directory* é o que separa os dois.** É ela que decide qual dos dois
`netlify.toml` o Netlify lê, e trocá-la põe um site a servir o conteúdo do outro.

**Porque não é tudo o mesmo site:** a app tem de ficar na raiz do seu próprio
endereço. O build do Expo referencia tudo por caminhos absolutos (`/_expo/...`)
e numa subpasta (`/app`) não encontraria nada.

**E o endereço da app não deve mudar depois de alguém a instalar.** Uma app
instalada é identificada pelo endereço: os dados offline e a sessão ficam
guardados por origem. Mudar de endereço deixa quem a tinha instalada com uma
app vazia e sem sessão.

## A página de apresentação

Também é construída a cada `push`, tal como a app. **Os dois sites saem do mesmo
repositório e é a *base directory* que os distingue** — é a única definição que
não se pode errar aqui.

### Ligar ao GitHub (uma vez só)

O site nasceu por *drag and drop*, o que obrigava a repetir o arrasto a cada
alteração — e era o passo que se esquecia, porque o site continuava a servir a
versão antiga sem nada avisar. Para acabar com isso, liga-o ao repositório:

1. Em <https://app.netlify.com> → o site **`gestaogado`** → **Site
   configuration** → **Build & deploy** → **Continuous deployment** →
   **Link repository** → **GitHub** → o repositório `GADOOOOOO`.
2. **Branch to deploy: `main`.** É o branch de produção; o `dev` não deve
   publicar a página real.
3. **Base directory: `website`** ← **é esta que importa.** Com ela vazia o
   Netlify lê o `netlify.toml` da RAIZ e constrói a **app** em cima do endereço
   da apresentação, deixando os dois sites a servir a mesma coisa.
4. *Build command* e *publish directory*: **deixar vazios**. Vêm do
   `website/netlify.toml`, e o site é estático — não há build nenhum.

A partir daqui, cada `push` para o `main` que mexa em `website/` republica a
página sozinho. Um push que não lhe toque é cancelado pela regra `ignore` do
`website/netlify.toml`, para não gastar builds do plano grátis.

### Confirmar que ficou bem ligado

O primeiro deploy depois de ligar deve aparecer em **Deploys** com origem no
commit do GitHub (e não como *manual deploy*). Se aparecer um build a correr
`npx expo export`, a *base directory* ficou vazia — é a app a ser construída no
site errado. Corrige o passo 3 e volta a fazer *Trigger deploy*.

## O site da app (uma vez só)

Este tem de ser ligado ao GitHub, porque é construído a cada publicação:

1. Em <https://app.netlify.com> → **Add new site** → **Import an existing
   project** → **GitHub** → escolhe o repositório `GADOOOOOO`.
2. **Base directory: deixa vazio** (a raiz). É isso que faz o Netlify ler o
   `netlify.toml` da raiz — o da app — e não o da página de apresentação.
3. O *build command* e o *publish directory* já vêm do `netlify.toml`. Não
   preencher nada. As chaves do Supabase também lá estão, não há variáveis de
   ambiente a configurar.
4. **Site configuration → Change site name → `app-gestaogado`.** Tem de ser
   exatamente este nome: é o endereço para onde o botão "Abrir no computador"
   aponta (`website/index.html`). Se usares outro, muda também lá o botão.

A partir daqui, cada `push` para o `main` reconstrói a app sozinho.

### O que o utilizador vê

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

- **Custo:** o build corre no GitHub Actions (grátis e ilimitado em repositório
  público) e o download é servido pelo GitHub — **não pesa no Netlify**.
- **Reconstruir localmente** (opcional): ver [`../desktop/README.md`](../desktop/README.md).
