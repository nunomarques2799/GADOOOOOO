# Migrar o alojamento para o Cloudflare Pages

Guia de uma vez só: passar os dois sites do Netlify para o Cloudflare Pages e
pô-los no domínio próprio `terrabovina.pt`.

**Faz-se tudo de uma vez, e é de propósito.** O passo caro desta mudança não é
trocar de alojamento — é **mudar o endereço da app**, porque isso desliga a
sessão e a cache de quem já a tem instalada (ver a secção do risco). Mudar o
endereço agora e o alojamento daqui a uns meses pagava esse preço duas vezes.

## Porquê sair do Netlify

O plano grátis do Netlify passou a créditos: **300 por mês**, dos quais **15 por
cada deploy de produção** e **20 por GB** servido. Com dois sites, publicar
gasta 30 créditos — dá cerca de **dez publicações por mês**, e quando os
créditos acabam **os sites são suspensos até ao mês seguinte**.

No Cloudflare Pages, o plano grátis dá **500 builds/mês**, **largura de banda
sem limite** e permite uso comercial (o Hobby da Vercel não permite — ficava a
proibir cobrar pela app um dia). Os dois sites juntos são **56 ficheiros e
7,9 MB**; o teto do plano grátis são 20 000 ficheiros e 25 MB por ficheiro.

Nada do que a app faz depende do Netlify: o conteúdo é estático e o servidor é
o Supabase.

## O que muda e o que não muda

| | Netlify (hoje) | Cloudflare Pages |
| --- | --- | --- |
| Configuração | `netlify.toml` (dois) | painel + `_headers` |
| Encaminhamento da app (SPA) | `[[redirects]]` para `/index.html` | **automático**, sem ficheiro |
| `/recuperar`, `/privacidade`, `/termos` | `[[redirects]]` | **automático** (URLs sem extensão) |
| Cabeçalhos de cache | `[[headers]]` | `public/_headers`, `website/_headers` |
| Não reconstruir à toa | `ignore = "git diff …"` | *Build watch paths*, no painel |
| Chaves por ambiente | `[context.branch-deploy]` | ambientes *Production* / *Preview* |
| Versão do Node | `NODE_VERSION = "22"` | `.node-version` (raiz) |

**Não muda nada** na app Windows (serve ficheiros locais), no instalador (vive no
GitHub Releases), no telemóvel (EAS Update) nem no Supabase enquanto o endereço
for o mesmo.

## ⚠️ Antes de mexer na app: o que se pode perder

A sessão, a cache e a fila de escritas por sincronizar são guardadas **por
origem**. Assim que a app passar a responder noutro endereço, quem a tinha
instalada abre-a **vazia e sem sessão**:

- **A fila `gado.outbox.v1` fica órfã** — é a única perda de dados a sério.
- Sessão terminada: tem de voltar a entrar.
- Reiniciam alertas dispensados, preferências de notificações, som/vibração e o
  tutorial já visto (`dispensados.ts`, `notificacoes.tsx`, `tutorial.ts`).
- O `id: "/"` do `manifest.json` resolve contra a origem: para o sistema é uma
  **app nova**, e a antiga fica instalada a apontar para o endereço velho.

Sobrevive tudo o que está no Supabase (animais, eventos, terrenos, documentos) e
a paleta de cores, que é guardada na conta.

**Ordem segura:**

1. Domínio primeiro **só na apresentação** — risco zero, e testa o DNS.
2. Pedir ao criador que abra a app com rede e confirmar que **não fica nada por
   sincronizar** (banner de pendentes vazio).
3. Só então mudar a app, avisando que vai pedir a palavra-passe outra vez.
4. Apagar e reinstalar o atalho no computador dele.

## Passo 1 — projeto da app

*Workers & Pages* → *Create* → separador **Pages** → *Connect to Git* →
repositório `GADOOOOOO`.

> ⚠️ **O separador Pages é o que interessa, e não é o caminho por omissão.** O
> botão grande de importar repositório da página principal cria um **Worker com
> assets estáticos**, não um projeto Pages. À primeira vista parece o mesmo —
> liga ao Git, constrói a cada push, serve ficheiros — mas:
>
> - o endereço não é `*.pages.dev`; é um `*.workers.dev` que **nasce desligado**
>   ("No URLs enabled"), por isso nada responde mesmo com o build a passar;
> - não há o par de ambientes *Production* / *Preview* em que assenta o passo 3.
>   Como o Metro **cozinha as `EXPO_PUBLIC_*` dentro do bundle**, essa separação
>   é o que impede um build do `dev` de sair a falar com os dados reais do
>   criador. Sem ela, o erro não é um build partido — é um build que funciona
>   perfeitamente contra a base errada.
>
> Como reconhecer que ficou Worker: o endereço do painel tem `/workers/services/`
> em vez de `/pages/`, e as métricas dizem *"Metrics is unavailable for Workers
> with only static assets"*.

| Definição | Valor |
| --- | --- |
| Nome do projeto | `terrabovina-app` |
| Branch de produção | `main` |
| Framework preset | *None* |
| Build command | `npx expo export --platform web` |
| Build output directory | `dist` |
| Root directory | *(vazio — a raiz)* |

*Settings* → *Build* → **Build watch paths** → *Include paths*:

```
src/*
public/*
assets/*
app.json
package.json
package-lock.json
tsconfig.json
.node-version
```

Substitui o `ignore` do `netlify.toml`: sem isto, mexer só na documentação ou
nos schemas reconstruía a app. O `*` do Cloudflare **atravessa barras**, por
isso `src/*` chega para toda a árvore.

As duas últimas linhas são as que não se adivinham: o `tsconfig.json` é onde
vive o atalho `@/` que o Metro lê, e o `.node-version` é o que fixa o Node 22.
Fora da lista, mudá-los não dava build nenhum — e ficava a parecer que a
alteração não tinha feito nada.

> ⚠️ A documentação não diz textualmente se estes caminhos são relativos à raiz
> do repositório ou à *root directory* — os exemplos de monorepo indicam que é à
> raiz. Foi exatamente aqui que o `ignore` do Netlify se enganou (`:/website` vs
> `website`) e a página ficou meses sem atualizar em silêncio. **Confirma nos
> primeiros dois pushes:** um que mexa em `src/` tem de construir, um que mexa
> só em `supabase/` tem de ser ignorado.

## Passo 2 — projeto da apresentação

Segundo projeto Pages, **mesmo repositório**:

| Definição | Valor |
| --- | --- |
| Nome do projeto | `terrabovina` |
| Branch de produção | `main` |
| Framework preset | *None* |
| Build command | *(vazio — não há build)* |
| Build output directory | `/` |
| Root directory | `website` |

*Build watch paths* → *Include paths*: `website/*`

**A *root directory* é aqui o que a *base directory* era no Netlify** — é o que
separa os dois sites que saem do mesmo repositório. Errada, este projeto passa a
construir a app em cima do endereço da apresentação. Sinal de que ficou mal: um
build a correr `npx expo export` no site da apresentação.

## Passo 3 — variáveis de ambiente

*Settings* → *Variables and Secrets*, **no projeto da app**. O Cloudflare tem
dois ambientes, e mapeiam exatamente na regra que já existe: **só o `main` fala
com produção.**

**Production** (branch `main`):

```
EXPO_PUBLIC_SUPABASE_URL = https://qmkafibxlmgouslybafy.supabase.co
EXPO_PUBLIC_SUPABASE_KEY = sb_publishable_6bjhd0CNIAglOPGmBt9Zlw_2gE4tr_r
```

**Preview** (todos os outros branches, incluindo o `dev`):

```
EXPO_PUBLIC_SUPABASE_URL = https://wkaxskxfcnexiutjewui.supabase.co
EXPO_PUBLIC_SUPABASE_KEY = sb_publishable_YfMkGOsrK6nrctci_jwlkg_J8Vl4F_W
EXPO_PUBLIC_AMBIENTE     = dev
```

O ambiente *Preview* aplica-se a **qualquer** branch que não o de produção — dá
a mesma garantia que os dois blocos `[context.…]` do `netlify.toml` davam, sem
o risco de proteger só o `dev` e deixar outro branch a arrancar com os dados
reais do criador.

> ⚠️ **Sem estas variáveis a app sai em modo demo** — dados de exemplo, sem
> login, e sem nada no ecrã a explicar porquê. É o primeiro sintoma a
> reconhecer se o primeiro build parecer "vazio".

A chave é a *publishable*, protegida por RLS e já embutida no JavaScript que
toda a gente descarrega: não há aqui segredo a proteger.

O projeto da apresentação não leva variáveis nenhumas.

## Passo 3.5 — o primeiro build prova-se no `dev`, não no `main`

**A preparação desta migração está no `dev` e o `main` ainda não a tem.** No dia
em que isto foi escrito o `main` estava 40 commits atrás e não tinha
`.node-version`, `public/_headers` nem `website/_headers`.

Consequência: um build de produção agora sairia **sem os cabeçalhos de cache** —
o `sw.js` ficaria em cache e a app instalada presa numa versão antiga, que é
exatamente a avaria que o `_headers` existe para evitar — e com o Node que o
Cloudflare escolher, em vez do 22.

Por isso o primeiro build a olhar **é o preview do `dev`**, em
`dev.terrabovina-app.pages.dev`:

- tem os três ficheiros da preparação;
- corre no ambiente *Preview*, ou seja, contra o Supabase de **testes** — não
  toca nos dados do criador;
- serve para confirmar os cabeçalhos, o encaminhamento e as variáveis antes de
  existir domínio nenhum.

Só depois de o preview estar provado é que se publica `dev` → `main` e a
produção passa a ter os cabeçalhos.

> ⚠️ Não há atalho pela definição de *branch de produção*. Pôr o `dev` como
> branch de produção para "testar mais depressa" dá-lhe as variáveis de
> **Production** — ou seja, código de testes ligado aos dados reais.

## Passo 4 — o domínio

Com `terrabovina.pt` já na conta Cloudflare (nameservers mudados na Lusoaloja):

| Endereço | Projeto |
| --- | --- |
| `terrabovina.pt` | `terrabovina` |
| `www.terrabovina.pt` | redirecionar para o anterior |
| `app.terrabovina.pt` | `terrabovina-app` |

Em cada projeto: *Custom domains* → *Set up a domain*. Como o DNS já está no
Cloudflare, os registos são criados sozinhos e o certificado sai em minutos.

## Passo 5 — o que muda no código

Só quando os endereços novos estiverem a responder:

| Ficheiro | O quê |
| --- | --- |
| `src/data/auth.tsx:17` | `URL_RECUPERACAO` → `https://terrabovina.pt/recuperar` |
| `src/app/(tabs)/definicoes.tsx:109` | link da política de privacidade |
| `website/index.html:35,327` | os dois botões "Abrir no computador" → `https://app.terrabovina.pt` |
| `supabase/schema_notificacao_registo.sql:93` | `url_app` (e o valor **já gravado nas duas bases**) |
| `CONSTRUIR_iOS.md:192` | URL de privacidade declarado à Apple |
| `AMBIENTES.md`, `website/COMO-PUBLICAR.md` | documentação |

E, **nos dois projetos Supabase** (dev e produção): *Authentication* → *URL
Configuration* → *Site URL* e *Redirect URLs*. **Manter os endereços
`netlify.app` na lista durante algumas semanas** — quem tiver um email de
reposição antigo na caixa ainda o vai usar.

## Passo 6 — confirmar

```bash
curl -sI https://app.terrabovina.pt/sw.js | grep -i cache-control
```

Espera-se `no-cache`. Depois:

- `curl -sI https://app.terrabovina.pt/_expo/static/js/web/entry-*.js` → `immutable`
- abrir `https://app.terrabovina.pt/animais` **diretamente** → tem de carregar a
  app (é o encaminhamento automático a funcionar; se der 404, apareceu um
  `404.html` no `dist/`)
- `https://terrabovina.pt/recuperar` → tem de servir a página de recuperação
- pedir uma palavra-passe nova e confirmar que o email aponta para o novo endereço

## Recuar, se for preciso

Enquanto os dois `netlify.toml` continuarem no repositório e os sites Netlify
existirem, recuar é **apontar o DNS de volta** — nada no código impede.
Por isso os `netlify.toml` **ficam** até a migração estar provada.

## Desligar o Netlify (só no fim)

Depois de uma semana sem sobressaltos:

1. Apagar `netlify.toml` e `website/netlify.toml`.
2. Reescrever `website/COMO-PUBLICAR.md` para o Cloudflare.
3. Só então apagar os sites no painel do Netlify — enquanto existirem, os
   endereços `netlify.app` continuam a responder a quem tiver ligações antigas.
