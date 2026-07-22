# Ambientes — produção e testes

Há um criador a usar esta app **todos os dias, a sério**, com os animais dele lá
dentro. Não é um utilizador de demonstração: se os dados desaparecerem, são os
registos de identificação e os prazos legais (DGAV/SNIRA) de uma exploração real
que desaparecem, e uma coima é uma consequência possível.

Este documento existe para que experimentar deixe de ser arriscado.

## Os dois ambientes

| | **Produção** | **Testes (dev)** |
| --- | --- | --- |
| Quem usa | o criador | tu |
| Base de dados | projeto Supabase `qmkafibxlmgouslybafy` | projeto Supabase próprio |
| Site da app | `app-gestaogado.netlify.app` | `dev--app-gestaogado.netlify.app` |
| Branch | `main` | `dev` |
| Faixa roxa no topo | não | **sim** |
| Se partires isto | mau dia | não acontece nada |

A faixa roxa ([`FaixaAmbiente.tsx`](src/components/FaixaAmbiente.tsx)) é a parte
que parece menos séria e é das mais importantes: as duas apps são idênticas ao
pixel, e a diferença entre elas é uma variável de ambiente que não se vê. Se
alguma vez estiveres a apagar dados de teste **sem** a faixa roxa no ecrã, para.

## O dia a dia

```
trabalhas em `dev`  →  vês em dev--app-gestaogado.netlify.app  →  PR para `main`
```

1. `git checkout dev` — é aqui que se trabalha. Nunca direto no `main`.
2. Commit + push para `dev`. O Netlify reconstrói o site de testes; nada chega
   ao criador.
3. Testar a sério no site de testes: entrar, registar um animal, ver os alertas.
4. Quando estiver bom: pull request `dev` → `main`. A CI corre `tsc` + testes.
5. Merge. **É o merge que publica** — ver a secção seguinte.

## O que o merge para `main` dispara (e o que não dispara)

| Canal | Como chega ao criador | Automático? |
| --- | --- | --- |
| App web / PWA instalada | build do Netlify → service worker anuncia versão nova | **sim, no merge** |
| App Windows (.exe) | GitHub Actions → Release → electron-updater | **sim, no merge** |
| Telemóvel (Android) | `eas update --branch preview` | não — só quando o corres |

Ou seja: **fazer merge para `main` é publicar**. Não há um botão separado a
dizer "publicar agora". Trata o merge com esse peso.

### A armadilha do telemóvel

O canal EAS `preview` **é o canal do criador** — é o que está dentro do APK que
ele tem instalado. Portanto:

> ❌ Nunca correr `eas update --branch preview` a partir do branch `dev`.

Para testar no telemóvel sem lhe tocar: `npx expo start` e abrir com o **Expo
Go**. Não gasta quota de build e não chega a ninguém.

## Alterações à base de dados

É aqui que mora o risco a sério. O plano grátis do Supabase **não tem cópias de
segurança automáticas**: um `alter table` mal pensado em produção não tem
marcha-atrás nenhuma.

A ordem, sem exceções:

1. Escrever o `schema_*.sql` novo, idempotente. Ver
   [`supabase/MIGRACOES.md`](supabase/MIGRACOES.md).
2. Aplicar **no projeto de dev** e testar a app contra ele.
3. Cópia de segurança de produção:
   ```bash
   powershell scripts/backup.ps1 -Ambiente prod
   ```
4. Só então aplicar em produção (SQL Editor).
5. Acrescentar a linha à tabela de ordem em `MIGRACOES.md`.

**O passo 3 não é opcional.** É literalmente a única coisa entre um erro de
sintaxe e perder os dados de uma pessoa.

## Onde vivem as chaves de cada ambiente

Não há um sítio só — cada canal de distribuição traz as suas:

| Onde | Ficheiro | Serve |
| --- | --- | --- |
| Site da app (prod) | [`netlify.toml`](netlify.toml) → `[build.environment]` | produção |
| Site da app (dev) | [`netlify.toml`](netlify.toml) → `[context.dev.environment]` | testes |
| App Windows | [`build-windows.yml`](.github/workflows/build-windows.yml) | produção |
| Android / iOS | [`eas.json`](eas.json) → `build.<perfil>.env` | produção |
| A tua máquina | `.env` (fora do git) | **testes** |

O `.env` local aponta para **dev**. Até 2026-07-22 apontava para produção, o que
queria dizer que um `npm run web` na máquina de desenvolvimento escrevia na base
de dados do criador — sem aviso nenhum, porque nessa altura ainda não havia
faixa roxa a dizê-lo.

> As chaves `sb_publishable_*` são para o cliente e estão protegidas por RLS —
> já vão embutidas no JavaScript que qualquer pessoa descarrega. Não são segredo
> e por isso podem estar nestes ficheiros. A que **nunca** pode aparecer aqui é a
> `secret`/`service_role`, que ignora o RLS todo.

## Checklist antes de fazer merge para `main`

- [ ] `npx tsc --noEmit` e `npm test` passam
- [ ] Testado no site de testes, não só em `localhost`
- [ ] Se mexe na base de dados: aplicado em dev **e** backup de produção feito
- [ ] Se mexe em `app.json`/`package.json`: lembrar que exige `eas build` novo,
      não chega o `eas update` (ver `AGENTS.md`)
