# Publicar e atualizar — como funciona

## O site (uma vez só)

O site é estático. Publica-o **uma vez** no Netlify:

1. Vai a <https://app.netlify.com/drop>.
2. Arrasta a pasta **`website`** inteira para a página.
3. Fica online em segundos. (Podes mudar o nome/domínio nas definições.)

Não precisas de repetir isto quando lançares versões novas da app — ver abaixo.

## A app Windows (automático)

O download **não vive no site** — vive no **GitHub Releases** e é reconstruído
sozinho. O botão do site aponta sempre para:

```
https://github.com/nunomarques2799/GADOOOOOO/releases/download/windows/GestaoDeGado-Windows.zip
```

### O que acontece quando mudas a app

1. Fazes as tuas alterações no código da app.
2. Fazes **commit + push** para o `main` no GitHub.
3. O GitHub Actions (`.github/workflows/build-windows.yml`) corre sozinho:
   gera o build web → empacota a app Windows → cria o ZIP → atualiza o
   Release `windows`.
4. O link do site passa a servir a versão nova **automaticamente**.

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
