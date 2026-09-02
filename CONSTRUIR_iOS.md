# Pôr a app no iPhone

Esta máquina é **Windows**, onde não existe o Xcode. A app iOS é compilada na
**cloud da Expo** com o **EAS Build** — só precisa do terminal. O `app.json` e o
`eas.json` já estão configurados; o que falta é correr os comandos.

> A conta **Apple Developer** (99 USD/ano) já está paga. Era o que faltava: a
> Apple só deixa instalar uma app num iPhone real se ela for assinada por uma
> conta de programador.
>
> **A conta não é nossa — é da equipa `8785V5WL8W`** (João Carlos), onde o Nuno
> entrou como **Admin**. Faz-se login com o Apple ID próprio; o papel Admin é o
> que permite criar o certificado de distribuição, e um papel abaixo disso faz o
> build falhar a meio. A app já existe no App Store Connect com o
> `ascAppId` 6799063195 — o `eas submit` não a vai criar.

---

## Antes de começar

A conta Expo já está ligada nesta máquina (`otariodoing`) e o `eas-cli` já está
instalado. Para confirmar:

```bash
eas whoami
```

Se responder com o nome de utilizador, está tudo. Se não, `eas login`.

---

## A primeira vez tem de ser à mão

O primeiro build de iOS **tem de correr no terminal, não no GitHub Actions**. É
aí que o EAS pede o **Apple ID**, cria o certificado de distribuição e o perfil
de aprovisionamento, e os guarda na conta Expo. Só depois disso é que o workflow
automático (que corre `--non-interactive`) tem credenciais a que ir buscar.

Tenha o Apple ID e a palavra-passe à mão — e o telemóvel, para o código de
verificação em dois passos.

---

## Caminho A — instalar num iPhone conhecido (mais rápido)

Serve para pôr a app no seu iPhone ou no de quem está a testar. Não passa pela
Apple, não há revisão, e demora o tempo do build.

**1. Registar o aparelho** (uma vez por iPhone):

```bash
eas device:create
```

Escolhe-se "Website", e abre-se o link/QR **no próprio iPhone** para instalar o
perfil de registo. É preciso o UDID do aparelho, e é isto que o vai buscar.

**2. Construir:**

```bash
eas build --platform ios --profile preview
```

No fim (~15–25 min) o EAS dá um **link/QR**: abra-o no iPhone registado e a app
instala-se.

> **Um iPhone que não foi registado antes do build não consegue instalar.**
> Registar um aparelho novo obriga a repetir o build — o perfil de
> aprovisionamento traz a lista de aparelhos lá dentro.

---

## Caminho B — TestFlight (melhor para entregar a outra pessoa)

Serve quando a app é para alguém cujo aparelho não quer andar a registar. O
TestFlight instala-se como qualquer app, e os updates chegam sozinhos. Com
**testadores internos** (até 100, pessoas da sua equipa Apple) **não há revisão
da Apple** — o build fica disponível em minutos.

**Foi por aqui que a app chegou ao iPhone a 2026-08-07.** A receita que
funcionou, com as três armadilhas que custaram a apanhar:

```bash
git checkout main
powershell scripts/build-ios.ps1 -IssuerId "..." -SemSincronizarCapacidades -Enviar
```

O [`scripts/build-ios.ps1`](scripts/build-ios.ps1) trata das variáveis da API
Key. **Usa-se a cópia de `scripts/`, não a de `~/.appstoreconnect/`.** Houve
uma cópia fora do repositório enquanto o script exigia o `main` e só existia no
`dev` (o `git checkout main` apagava-o a meio), mas isso acabou a 2026-08-11,
quando ele chegou ao `main`. A cópia de fora é de 7 de agosto e está velha:
falta-lhe o `--latest` no `eas submit`, sem o qual o envio morre em modo não
interativo.

**1. O primeiro build TEM de ser interativo, mesmo com a API Key.** Em
`--non-interactive` o EAS recusa-se a criar credenciais de raiz
(*"Credentials are not set up. Run this command again in interactive mode"*).
Depois do primeiro, o certificado e o perfil ficam guardados na conta Expo e
os seguintes já correm sozinhos. Responde-se **Yes** ao certificado e ao
perfil.

A *"set up Push Notifications for your project"* responde-se **No** — mas já
não pela razão que aqui esteve escrita até 2026-09-02 ("a app só tem avisos
locais"). Desde as conversas a app manda avisos de mensagem nova, por isso a
chave APNs faz falta; o que não dá é criá-la por aqui. O **Yes** manda o EAS
gerá-la no portal da Apple, e isso exige login com Apple ID (*"Only user
authentication is supported. Reauthenticating as user..."*), que a API Key
**não** substitui. Num build corrido por um agente, ou por quem não tenha à
mão o Apple ID do titular, o **Yes** deixa o build pendurado à espera de uma
palavra-passe.

Responder **No** não estraga nada: a chave APNs vive no servidor da Expo e
nunca dentro do binário, por isso acrescenta-se depois **sem repetir o build**.
Ver a secção das notificações, mais abaixo.

**2. A sincronização automática de capacidades está partida.** O EAS manda um
pedido que a Apple já não aceita (*"not a valid request document object"* em
`bundleIdCapabilities`), e o `eas-cli` 21.7.0 não corrige. Como o plugin
`expo-notifications` mete `aps-environment` nos entitlements, o Bundle ID
precisa mesmo de **Push Notifications** ligada no portal — liga-se à mão e
passa-se `-SemSincronizarCapacidades`. Confirmar **antes** de construir, com
`node ~/.appstoreconnect/asc.js ver`: se a capacidade estiver desligada, o
perfil sai sem ela e a assinatura só rebenta no fim de compilar, com a quota
já gasta.

**3. O `eas submit` ignora as variáveis `EXPO_ASC_*`.** Quer a chave declarada
no `eas.json` (`ascApiKeyPath`, `ascApiKeyId`, `ascApiKeyIssuerId`), senão
responde *"App Store Connect API Keys cannot be set up in --non-interactive
mode"*. O `ascApiKeyPath` é um caminho absoluto desta máquina: **não se
commita**. Enquanto não houver melhor, edita-se o `eas.json` localmente, envia-
se, e desfaz-se com `git checkout -- eas.json`.

```bash
eas submit --platform ios --profile production --id <build-id> --non-interactive
```

**4. Um acordo da Apple por assinar mata o envio no ÚLTIMO passo.** A
2026-09-02 o build 8 compilou, o `eas submit` correu, o `.ipa` subiu inteiro
(os seis pedaços) e foi o `Committing upload` que levou com um 403:

    "code"  : "FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED",
    "title" : "A required agreement is missing or has expired."

É o Acordo de licença do Apple Developer Program, atualizado e por aceitar.
Assina-o **o titular da conta**, em <https://appstoreconnect.apple.com/business>
(`/business` é o link que a própria Apple devolve no erro), e mais ninguém.

Vê-se antes de gastar tempo: o App Store Connect põe uma faixa na página das
Apps — *"o titular da conta tem de rever e aceitar o acordo atualizado"*. Vale
a pena confirmar isso ANTES de construir, como já se faz com as capacidades do
Bundle ID. Nada se perde quando acontece: o build fica feito e repete-se só o
envio, que não gasta quota.

Ao mesmo tempo apareceu outro aviso lá, que não trava nada mas fica por fazer:
a Apple acrescentou perguntas de classificação etária sobre **capacidades de
redes sociais**, e com as conversas isso passou a aplicar-se. É na Informação
da app, e só interessa quando se publicar ao público.

Depois, no [App Store Connect](https://appstoreconnect.apple.com) → TestFlight
→ **Internal Testing**, cria-se o grupo e convida-se a pessoa por email. Ela
instala a app **TestFlight** e a Terrabovina aparece lá dentro. O build
**caduca ao fim de 90 dias**.

---

## Entregar alterações sem construir de novo

O `expo-updates` funciona no iPhone tal como no Android:

```bash
eas update --branch preview
```

Chega em segundos, sem reinstalar nada. **Regra:** mexeu só em `src/` → update;
mexeu em `app.json`, `package.json` ou em qualquer coisa nativa → build.

> **Cuidado com o canal.** O `--branch preview` é o telemóvel do criador. A
> partir do branch `dev` isso é publicar-lhe uma versão de testes — ver
> `AMBIENTES.md`.

---

## A quota do EAS

O plano gratuito tem **teto mensal de builds**, contado por plataforma. Um build
de iOS gasta quota tal como um de Android, por isso:

- o workflow `.github/workflows/build-ios.yml` **só corre à mão**
  (Actions → Build iOS app → Run workflow), nunca em push;
- a entrega normal é `eas update`, que não gasta quota nenhuma.

Um `eas build` que falha em ~10 segundos nunca chegou a compilar — é conta
(quota, token ou credenciais), não código.

---

## O que já está configurado, e porquê

Isto está no `app.json` e resolve coisas que só aparecem do lado da Apple:

| Definição | Porquê |
|-----------|--------|
| `ios.config.usesNonExemptEncryption: false` | Sem isto, **cada** envio para o TestFlight fica parado à espera que alguém responda ao questionário de "export compliance". A app só usa HTTPS normal, que é isento. |
| `NSAppTransportSecurity` fechado | O template do Expo traz `NSAllowsArbitraryLoads: true`, ou seja, ATS completamente desligado — a app aceitaria tráfego em claro para qualquer servidor. Nenhum endereço da app é `http://`, por isso está fechado, com `NSAllowsLocalNetworking` para o Metro continuar a funcionar em desenvolvimento. |
| `microphonePermission: false` no `expo-image-picker` | O plugin acrescentava `NSMicrophoneUsageDescription` sozinho, e o seletor de imagens não grava som nenhum. Pedir microfone sem o usar é das coisas que a revisão da Apple manda justificar. **Continua `false` aqui**, ao contrário do `expo-audio` (ver a linha seguinte). |
| `microphonePermission` com texto no `expo-audio` (desde 2026-08-23) | Estava `false`, e mudou porque as conversas passaram a ter **mensagens de voz** (`src/data/gravarAudio.ts`). A frase que lá está é a que o iPhone mostra no pedido, e tem de dizer para que é: "gravar mensagens de voz nas conversas com a sua equipa". Duas consequências: **a app instalada só grava depois de um BUILD NATIVO NOVO** (a permissão vive no binário), e o questionário de privacidade da App Store passa a ter de declarar áudio como conteúdo do utilizador. |
| `recordAudioAndroid: true` | O par Android do anterior. Acrescenta a permissão `RECORD_AUDIO` ao manifesto. |
| `expo-camera` com `microphonePermission: false` e `recordAudioAndroid: false` (desde 2026-08-25) | Entrou para as Existências lerem o código impresso nas caixas de medicamento (`src/components/LeitorCodigo.tsx`). Como o `expo-image-picker`, o plugin acrescentava microfone sozinho e a leitura de códigos não grava som nenhum. **O `barcodeScannerEnabled` fica no valor de omissão (`true`)**: desligá-lo tirava do binário exatamente aquilo para que o módulo entrou. O texto do `NSCameraUsageDescription` é o MESMO nos dois plugins de propósito, porque o iOS só tem uma frase por permissão e vence a do último plugin. **Consequências:** a app instalada só lê códigos depois de um BUILD NATIVO NOVO, e não há nada a mexer no questionário de privacidade (não se guarda imagem nenhuma, só o número impresso na caixa, que é dado do produto e não da pessoa). |
| `CFBundleDevelopmentRegion: "pt-PT"` | A app é só em português. Faz o sistema tratá-la como tal. |
| `ios.icon: "./assets/expo.icon"` | Ícone em formato Icon Composer (`assets/expo.icon/`). Trata sozinho das variantes clara/escura/tinted do iOS — não é preciso PNG de reserva. |

O teto de **64 notificações pendentes** do iOS (o sistema descarta o excedente
em silêncio) está respeitado em `src/data/notificacoesPlano.ts` —
`orcamentoParaAlertas` desconta os avisos de fim de acesso ao número de prazos
que se agendam.

---

## O que NÃO funciona no iPhone (nem no Android)

Importar e exportar **Excel** e guardar relatórios em **PDF** continuam a ser do
computador: escrever um ficheiro passa pelo DOM (ver `excelFicheiro.ts`). O ecrã
Documentos já diz isso em vez de mostrar botões que não fazem nada. Não é uma
limitação do iOS — é igual no Android.

---

## As notificações de mensagens (push) exigem uma chave da Apple

As conversas mandam um aviso ao telemóvel quando chega mensagem nova. O envio
já está feito e provado do lado da base de dados
(`supabase/schema_chat_push.sql`, que chama a API da Expo pelo `pg_net`), e a
app já pede e guarda o token (`src/data/push.ts`). **Falta o que só se faz na
conta da Apple**, uma vez:

```
eas credentials -p ios       # Push Notifications → criar/ligar a chave APNs
eas credentials -p android   # carregar as credenciais FCM V1
```

Sem a chave, o `getExpoPushTokenAsync` nem chega a devolver token: a app não
rebenta (o `push.ts` engole o erro), fica é sem avisos com a app fechada,
exatamente como estava antes.

**O que precisa de build e o que não precisa** (apurado a 2026-09-02, porque
aqui dizia só "um build nativo novo" e isso baralhava as duas coisas):

- Precisa de build o `aps-environment` nos entitlements, que vem do plugin
  `expo-notifications` e do perfil de aprovisionamento. **O build 8 já o
  traz**, porque a capacidade Push Notifications está ligada no Bundle ID.
- **Não precisa de build a chave APNs.** Vive no servidor da Expo, que é quem
  fala com a Apple, e nunca entra no binário. Acrescenta-se quando aparecer.

**Como se arranja a chave, que não é pelo caminho óbvio:**

- O `eas credentials -p ios` autentica-se com a API Key para tudo o resto, mas
  para *gerar* a chave responde *"Only user authentication is supported"* e
  pede Apple ID e palavra-passe.
- A App Store Connect API **não tem endpoints de chaves**: `/v1/keys`,
  `/v1/apnsKeys`, `/v1/pushKeys` e `/v1/authKeys` devolvem 404. Não há como
  automatizar isto pelo `asc.js`, ao contrário das capacidades.
- O Apple ID do Nuno **não serve**: o portal responde *"Unable to find a team
  with the given Team ID ... to which you belong"*, e a página de conta pede
  para comprar a subscrição. Ser Admin no App Store Connect não é pertencer à
  equipa no portal de programador — é a mesma armadilha que está no cabeçalho
  do `scripts/build-ios.ps1`.

Sobra um caminho: **o titular da conta** cria a chave em developer.apple.com →
Certificates, Identifiers & Profiles → **Keys** → **+** → *Apple Push
Notification service (APNs)*, e passa o ficheiro `.p8` (a Apple só o deixa
descarregar uma vez). Depois carrega-se à mão, sem login nenhum:

    eas credentials -p ios
      -> perfil production
      -> Push Notifications: Manage your Apple Push Notifications Key
      -> Add a new push key
      -> "Generate a new Apple Push Notifications service key?"   No
      -> Path to P8 file:   <caminho do .p8>

O menu só aparece com terminal a sério: em stdin redirecionado o `eas
credentials` recusa-se logo (*"Input is required, but stdin is not readable"*).

Para confirmar que está a funcionar, depois de instalar o build novo em dois
aparelhos com contas diferentes:

```sql
select * from public.push_token;      -- tem de ter uma linha por aparelho
select * from public.push_recentes(); -- 'entregue' = a Expo aceitou
```

O `push_recentes()` mostra a resposta da Expo. `DeviceNotRegistered` quer dizer
que o token morreu (a app foi desinstalada); `entregue` quer dizer que a
notificação saiu daqui, e o que acontece a seguir é com a Apple.

---

## Se quiser publicar na App Store (mais tarde)

Além do build e do `eas submit`, a Apple pede:

- **Política de privacidade** com URL público — já existe:
  `https://terrabovina.pt/privacidade`;
- **capturas de ecrã** nos tamanhos que o App Store Connect exigir;
- o questionário de **privacidade** (que dados a app recolhe) — há conta, email,
  dados da exploração e fotografias, guardados no Supabase;
- classificação etária e categoria;
- revisão da Apple, que pode demorar dias e costuma vir com perguntas.
