# Pôr a app no iPhone

Esta máquina é **Windows**, onde não existe o Xcode. A app iOS é compilada na
**cloud da Expo** com o **EAS Build** — só precisa do terminal. O `app.json` e o
`eas.json` já estão configurados; o que falta é correr os comandos.

> A conta **Apple Developer** (99 USD/ano) já está paga. Era o que faltava: a
> Apple só deixa instalar uma app num iPhone real se ela for assinada por uma
> conta de programador.

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

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

O `eas submit` pergunta o Apple ID e o `ascAppId` na primeira vez e guarda-os.
Se a app ainda não existir no App Store Connect, oferece-se para a criar com o
nome e a língua que estão no `eas.json` (`submit.production.ios`).

Depois, no [App Store Connect](https://appstoreconnect.apple.com) → TestFlight,
convida-se a pessoa por email.

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
| `microphonePermission: false` no `expo-image-picker` | O plugin acrescentava `NSMicrophoneUsageDescription` sozinho. A app nunca grava som, e pedir microfone sem o usar é das coisas que a revisão da Apple manda justificar. |
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

## Se quiser publicar na App Store (mais tarde)

Além do build e do `eas submit`, a Apple pede:

- **Política de privacidade** com URL público — já existe:
  `https://gestaogado.netlify.app/privacidade`;
- **capturas de ecrã** nos tamanhos que o App Store Connect exigir;
- o questionário de **privacidade** (que dados a app recolhe) — há conta, email,
  dados da exploração e fotografias, guardados no Supabase;
- classificação etária e categoria;
- revisão da Apple, que pode demorar dias e costuma vir com perguntas.
