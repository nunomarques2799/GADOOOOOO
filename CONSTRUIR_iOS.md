# Construir a app para iPhone (a partir do Windows)

Este projeto está em **Windows**, onde não existe o Xcode. A app iOS é
compilada na **cloud da Expo** com o **EAS Build** — só precisa do terminal.
O `eas.json` e o `app.json` já estão configurados para isto.

> **Porque é que a app deixou de abrir no Expo Go?** Ao ligar a base de dados
> (`expo-sqlite`, código nativo), a app passou a precisar de um *build próprio*.
> O Expo Go já não chega — é isso que os passos abaixo resolvem.

---

## Passo 0 — A conta Apple Developer (decisão sua)

A Apple **só deixa instalar uma app num iPhone real se ela for assinada por uma
conta de programador**. Há duas realidades:

| Opção | Custo | Dá para instalar no iPhone via EAS (Windows)? |
|-------|-------|-----------------------------------------------|
| **Apple Developer Program** | **99 USD/ano** | ✅ Sim — o caminho recomendado |
| Apple ID gratuito | grátis | ❌ Não pelo EAS (só via Xcode num Mac, e expira em 7 dias) |

Como está em Windows (sem Mac para o simulador), para ver a app no seu iPhone
vai precisar da **conta paga**. Não tem de decidir agora: o código está pronto e
os passos ficam à espera. **A conta tem de ser criada por si** (envolve dados
pessoais e pagamento) em [developer.apple.com](https://developer.apple.com).

---

## Passo 1 — Conta Expo (grátis) e ferramenta EAS

1. Criar conta grátis em [expo.dev](https://expo.dev) (guarde o utilizador/palavra-passe).
2. No terminal, dentro de `gestao-gado`:

```bash
npm install -g eas-cli     # instala a ferramenta (uma vez)
eas login                  # entra com a conta Expo
eas init                   # liga este projeto à sua conta (cria o projectId)
```

`eas init` escreve o `projectId` no `app.json` automaticamente.

---

## Passo 2 — Registar o seu iPhone (precisa da conta do Passo 0)

```bash
eas device:create
```

Segue um link/QR **no próprio iPhone** para registar o aparelho. É este passo que
exige a conta Apple Developer paga.

---

## Passo 3 — Compilar

Para **ver a app a funcionar** no iPhone (versão autónoma, com a base de dados real):

```bash
eas build --profile preview --platform ios
```

O EAS vai pedir para entrar com o seu **Apple ID** e trata sozinho dos
certificados. No fim (~15–25 min) dá um **link/QR** — abra-o no iPhone para instalar.

> Para desenvolvimento contínuo (recarregar alterações ao vivo), use antes
> `--profile development` e depois `npx expo start --dev-client`.

---

## Passo 4 — TestFlight / App Store (mais tarde)

Quando quiser distribuir a outras pessoas ou publicar:

```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Requer a mesma conta paga, ícones/capturas e a revisão da Apple (pode demorar dias).

---

## Resumo do que depende de si

- [ ] Decidir sobre a **conta Apple Developer** (99 USD/ano) — necessária para o iPhone real
- [ ] Criar **conta Expo** (grátis)
- [ ] Correr `eas login`, `eas init`, `eas device:create`, `eas build`

Tudo o resto (código, base de dados, configuração EAS) já está feito.
