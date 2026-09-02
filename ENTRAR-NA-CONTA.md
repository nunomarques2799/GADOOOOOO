# Entrar na conta: email, Google, Apple e telemóvel

Este ficheiro é a lista de cliques que **só tu podes dar**. O código da app já
está escrito e aguenta as credenciais em falta sem partir: um método de entrada
sem credenciais simplesmente não aparece no ecrã, e nada rebenta. À medida que
fores fazendo cada passo, o botão correspondente acende sozinho.

Ordem recomendada, e não é arbitrária: o **1** está partido em produção hoje, o
**2** é grátis e não depende de ninguém, o **3** depende da conta Apple do teu
colega, e o **4** custa dinheiro a cada mensagem.

| # | O quê | Custo | Depende de |
| --- | --- | --- | --- |
| 1 | SMTP próprio (recuperar a palavra-passe) | grátis até 100 emails/dia | Resend + `terrabovina.pt` |
| 2 | Google | grátis | Google Cloud |
| 3 | Apple | grátis | conta Apple Developer (é do teu colega) |
| 4 | Telemóvel por SMS | ~7 cêntimos por mensagem | Twilio |
| 5 | Ligar várias contas à mesma pessoa | grátis | um interruptor no Supabase |

---

## 1. SMTP próprio — o que está partido HOJE

### O problema, em duas linhas da documentação do Supabase

> *"Supabase Auth will refuse to deliver messages to addresses that are not part
> of the project's team."*
> *"the number of messages your project can send is limited"* — **2 mensagens
> por hora**, e *"not meant for production use"*.

O registo não sofre com isto, porque a confirmação de email está DESLIGADA nos
dois projetos (`mailer_autoconfirm: true`): quem cria conta entra logo, e não se
envia email nenhum. Cinquenta contas em cinco minutos passam sem problema.

A **recuperação da palavra-passe** é que envia mesmo. E hoje, em produção, quem
não estiver na equipa do projeto Supabase recebe `Email address not authorized`
e não recebe email nenhum. Ninguém deu por isso porque o único utilizador real
nunca precisou. Vai dar, assim que a app tiver gente lá dentro.

### Os cliques

1. **Resend → Domains → Add Domain**: `terrabovina.pt`.
   O Resend mostra registos DNS (um `MX`, dois ou três `TXT`). Mete-os no
   **Cloudflare**, que é quem manda no domínio (ver `MIGRAR_CLOUDFLARE.md`), com
   o *proxy desligado* (nuvem cinzenta) — um registo de email atrás do proxy do
   Cloudflare não funciona. Espera pelo "Verified".

   > Enquanto o domínio não estiver verificado, o Resend **só envia para o email
   > do dono da conta**. É a mesma limitação que os avisos ao superadmin já
   > têm hoje (`schema_notificacao_registo.sql` usa `onboarding@resend.dev`), e
   > é por isso que este passo não é opcional.

2. **Resend → API Keys → Create API Key**, permissão *Sending access*. Guarda a
   chave: é ela que serve de palavra-passe do SMTP.

3. **Supabase → Project Settings → Authentication → SMTP Settings** (no projeto
   de **produção** e depois no de **testes**):

   | Campo | Valor |
   | --- | --- |
   | Enable Custom SMTP | ligado |
   | Sender email | `nao-responder@terrabovina.pt` |
   | Sender name | `Terrabovina` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | a chave do passo 2 |

4. **Supabase → Authentication → Rate Limits → "Rate limit for sending emails"**:
   o Supabase põe **30 por hora** assim que há SMTP próprio. Sobe para o que
   fizer sentido (o teto real passa a ser o do Resend: 100/dia no plano grátis).

5. **Provar que ficou bom**: na app, "Esqueci-me da palavra-passe" com um email
   que NÃO seja o teu nem o de ninguém da equipa do projeto. Tem de chegar. Se
   vier `Email address not authorized`, o SMTP não está ligado; se vier
   `over_email_send_rate_limit`, é o passo 4 que falta.

---

## 2. Google

Três credenciais, porque o Google trata cada plataforma como uma aplicação
diferente. **Google Cloud Console → APIs & Services → Credentials → Create
credentials → OAuth client ID**, três vezes:

| Tipo | Para quê | O que pede |
| --- | --- | --- |
| **Web application** | a app na web, e é TAMBÉM a que o Supabase usa para validar os outros dois | Authorized redirect URI: `https://qmkafibxlmgouslybafy.supabase.co/auth/v1/callback` (o de produção; repete com `wkaxskxfcnexiutjewui` para testes) |
| **iOS** | o botão no iPhone | Bundle ID: o `ios.bundleIdentifier` do `app.json` |
| **Android** | o botão no Android | Package name do `app.json` + a impressão digital SHA-1 (dá-a o `eas credentials`) |

Depois:

- **Supabase → Authentication → Providers → Google**: ligar, e meter o **Client
  ID e o Client Secret da credencial WEB**. No campo *Authorized Client IDs*
  mete os IDs do **iOS e do Android**, separados por vírgula — é isso que faz o
  Supabase aceitar os tokens que os telemóveis lhe entregam.
- No `.env` (e no `eas.json`, e no `netlify.toml`, e no
  `build-windows.yml` — os mesmos quatro sítios das chaves do Supabase, ver
  `AMBIENTES.md`):

  ```
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
  ```

  Sem estas duas variáveis o botão do Google não aparece, e a app funciona como
  sempre funcionou.

> **Isto obriga ao Apple.** A diretriz 4.8 da App Store diz que uma app que use
> um serviço de login de terceiros tem de oferecer **em alternativa equivalente**
> outro que limite a recolha ao nome e email e deixe esconder o email. Na
> prática é o Sign in with Apple. A app já está na loja: pôr o Google no iPhone
> sem o Apple é rejeição na atualização seguinte.

---

## 3. Apple

**A conta Apple Developer é do teu colega** (ver a nota em `CONSTRUIR_iOS.md`), e
estes passos são no portal dele:

1. **Certificates, Identifiers & Profiles → Identifiers**: no App ID da app,
   ligar a capacidade **Sign In with Apple**.
2. **Identifiers → +→ Services IDs**: criar um (ex.: `pt.terrabovina.web`), com
   *Sign In with Apple* ligado. Em *Configure*:
   - Domains: `qmkafibxlmgouslybafy.supabase.co`
   - Return URLs: `https://qmkafibxlmgouslybafy.supabase.co/auth/v1/callback`
3. **Keys → +**: chave nova com *Sign In with Apple*. Descarrega o `.p8` (só se
   descarrega **uma vez**) e aponta o Key ID e o Team ID.
4. **Supabase → Authentication → Providers → Apple**: ligar e preencher com o
   Services ID, o Team ID, o Key ID e o conteúdo do `.p8`.

No iPhone o botão não precisa de variável nenhuma: o `expo-apple-authentication`
pergunta ao sistema se está disponível e a app decide a partir daí. Na web e no
Android, o Apple entra pelo caminho do navegador.

---

## 4. Telemóvel por SMS

**É o único que custa dinheiro, e custa a cada tentativa.** O Supabase não envia
SMS: só fala com um fornecedor teu.

1. **Twilio → Messaging → Try it out → Get a Twilio phone number** (ou um
   *Messaging Service*, que é o que a Twilio recomenda para Portugal).
2. **Supabase → Authentication → Providers → Phone**: ligar, escolher Twilio, e
   meter o Account SID, o Auth Token e o número/Messaging Service SID.
3. **Supabase → Authentication → Rate Limits**: baixar o *"Rate limit for sending
   SMS messages"* dos 30/hora que vêm por omissão para o que faz sentido a esta
   app. É aqui que se trava uma conta a pedir códigos a eito.
4. **Supabase → Authentication → Attack Protection → Enable Captcha protection**
   (hCaptcha ou Turnstile). A documentação do Supabase pede-o expressamente para
   o telemóvel, e a razão é simples: sem ele, qualquer pessoa com um script gasta
   o teu saldo da Twilio a partir de casa.

No `.env` e nos outros três sítios:

```
EXPO_PUBLIC_LOGIN_TELEMOVEL=1
```

Sem esta variável o separador do telemóvel não aparece. É de propósito: é um
interruptor que se desliga num minuto se as contas da Twilio começarem a subir,
sem esperar por um build.

---

## 5. Ligar várias contas à mesma pessoa

**Supabase → Authentication → Providers → (fundo da página) → Manual Linking**:
ligar. Sem isto, o ecrã do Perfil aparece mas cada tentativa devolve
`Manual linking is disabled`, e a app diz isso mesmo em vez de fingir.

---

## 6. E depois: um build nativo

O Google e o Apple no telemóvel são **módulos nativos**, e o `app.json` ganhou
plugins por causa deles. Uma entrega de JS (`eas update`) **não chega**: é
preciso `eas build`. Ver `CONSTRUIR_iOS.md` e a nota sobre a quota do EAS.

Enquanto o build não sair, a app instalada continua com o email e mais nada — o
que é exatamente o que ela faz hoje, e por isso não se parte nada ao publicar
esta alteração pelo `eas update` normal.
