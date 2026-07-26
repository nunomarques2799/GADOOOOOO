<#
.SYNOPSIS
    Cópia de segurança de uma base de dados Supabase da Terrabovina.

.DESCRIPTION
    O plano grátis do Supabase NÃO tem cópias de segurança automáticas nem
    point-in-time recovery. Se uma migração correr mal, ou se um `delete` sem
    `where` passar despercebido, não há nada para onde voltar. Este script é
    esse "nada para onde voltar".

    Corre-o SEMPRE antes de aplicar qualquer schema*.sql em produção. É a
    diferença entre um susto de dez minutos e perder os registos de um criador
    que anda a usar a app todos os dias.

    Gera três ficheiros, que juntos permitem reconstruir a base:
      roles.sql   — papéis do Postgres
      schema.sql  — tabelas, políticas de RLS, funções, triggers (schema public)
      dados.sql   — o conteúdo das tabelas (public) e as contas (auth)

.PARAMETER Ambiente
    'prod' ou 'dev'. Decide de que base se faz a cópia e para que pasta vai.

.EXAMPLE
    powershell scripts/backup.ps1 -Ambiente prod

.NOTES
    FERRAMENTAS. Usa o `pg_dump`/`pg_dumpall` instalados na máquina. Se não os
    encontrar, cai no `npx supabase db dump` — que faz o mesmo trabalho mas
    corre o pg_dump DENTRO de um contentor e por isso exige o Docker Desktop.

    A 2026-07-26 esta máquina não tinha nem um nem outro, e o script parava com
    "Docker Desktop is a prerequisite" — ou seja, a cópia de segurança de que
    tudo isto depende nunca tinha corrido. Instalar o PostgreSQL resolve as
    duas metades do problema: o `pg_dump` faz a cópia e o `psql` restaura-a. O
    Docker só dá a primeira.

        winget install -e --id PostgreSQL.PostgreSQL.17

    O `pg_dump` tem de ser de versão IGUAL OU SUPERIOR à do servidor, senão
    recusa-se a correr (di-lo com todas as letras). O Supabase corre PG 15/17.

    LIGAÇÃO. Vem de uma variável de ambiente ou do ficheiro `.env.backup` na
    raiz do repositório (que está no .gitignore — contém a palavra-passe da
    base e NUNCA pode ser committado):

        GADO_DB_URL_PROD=postgresql://postgres.xxxx:PALAVRA@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
        GADO_DB_URL_DEV=postgresql://postgres.yyyy:PALAVRA@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

    Onde encontrar: Dashboard do projeto -> Project Settings -> Database ->
    Connection string -> URI. Substituir [YOUR-PASSWORD] pela palavra-passe da
    base de dados (a que foi definida ao criar o projeto).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('prod', 'dev')]
    [string]$Ambiente
)

$ErrorActionPreference = 'Stop'

$raizRepo = Split-Path -Parent $PSScriptRoot
$nomeVariavel = "GADO_DB_URL_" + $Ambiente.ToUpper()

# ------------------------------------------------------------------
# 1. Descobrir a ligação (variável de ambiente OU .env.backup)
# ------------------------------------------------------------------
$ligacao = [Environment]::GetEnvironmentVariable($nomeVariavel)

if ([string]::IsNullOrWhiteSpace($ligacao)) {
    $ficheiroEnv = Join-Path $raizRepo '.env.backup'
    if (Test-Path $ficheiroEnv) {
        foreach ($linha in (Get-Content $ficheiroEnv)) {
            if ($linha -match "^\s*$nomeVariavel\s*=\s*(.+?)\s*$") {
                $ligacao = $Matches[1].Trim('"').Trim("'")
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($ligacao)) {
    Write-Host ""
    Write-Host "Falta a ligacao a base de dados de '$Ambiente'." -ForegroundColor Red
    Write-Host ""
    Write-Host "Cria o ficheiro .env.backup na raiz do repositorio com a linha:"
    Write-Host "  $nomeVariavel=postgresql://postgres.<ref>:<palavra-passe>@<host>:5432/postgres"
    Write-Host ""
    Write-Host "Vais buscar isso a: Dashboard -> Project Settings -> Database"
    Write-Host "                    -> Connection string -> URI"
    Write-Host ""
    exit 1
}

# ------------------------------------------------------------------
# 2. Descobrir as ferramentas
# ------------------------------------------------------------------
# O instalador do PostgreSQL no Windows nao poe o bin\ no PATH. Procurar la
# tambem evita a conversa do "instalei e continua a dizer que nao existe".
function Procurar-Ferramenta {
    param([string]$Nome)

    $noPath = Get-Command $Nome -ErrorAction SilentlyContinue
    if ($noPath) { return $noPath.Source }

    $pastas = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue
    if (-not $pastas) { return $null }

    # Versao mais alta primeiro: o pg_dump tem de ser >= servidor, nunca menor.
    $encontrados = $pastas |
        Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
        ForEach-Object { Join-Path $_.FullName "bin\$Nome.exe" } |
        Where-Object { Test-Path $_ }

    if ($encontrados) { return @($encontrados)[0] }
    return $null
}

$pgDump = Procurar-Ferramenta 'pg_dump'
$pgDumpAll = Procurar-Ferramenta 'pg_dumpall'
$psql = Procurar-Ferramenta 'psql'

$modo = 'cli'
if ($pgDump -and $pgDumpAll) { $modo = 'pgdump' }

if ($modo -eq 'cli') {
    Write-Host ""
    Write-Host "pg_dump nao encontrado - vou tentar pelo Supabase CLI (exige Docker Desktop)." -ForegroundColor Yellow
    Write-Host "Se falhar com 'Docker Desktop is a prerequisite', instala antes:" -ForegroundColor Yellow
    Write-Host "  winget install -e --id PostgreSQL.PostgreSQL.17" -ForegroundColor Yellow
    Write-Host ""
}

# ------------------------------------------------------------------
# 3. Pasta de destino — FORA do repositorio
# ------------------------------------------------------------------
# Uma copia de seguranca tem nomes, NIFs, telefones e emails de pessoas reais.
# Nao pode ficar dentro de uma pasta com git, onde um `git add -A` distraido a
# empurra para um repositorio publico. Vai para ..\backups\ (irmao do repo).
$carimbo = Get-Date -Format 'yyyy-MM-dd_HHmm'
$destino = Join-Path (Split-Path -Parent $raizRepo) "backups\$Ambiente\$carimbo"
New-Item -ItemType Directory -Force -Path $destino | Out-Null

Write-Host ""
Write-Host "Copia de seguranca de '$Ambiente'" -ForegroundColor Cyan
Write-Host "Destino: $destino"
if ($modo -eq 'pgdump') { Write-Host "Ferramenta: $pgDump" }
Write-Host ""

# ------------------------------------------------------------------
# 4. Os tres dumps
# ------------------------------------------------------------------
# `--no-role-passwords`: sem ele, o pg_dumpall le a pg_authid, que no Supabase
#   e so para superutilizadores - e o `postgres` da base gerida nao o e.
# `--schema=auth` nos dados: sem as contas, os dados restaurados ficam sem dono
#   e ninguem consegue entrar na app para lhes chegar.
# `--disable-triggers`: repor so os dados, com as chaves estrangeiras ativas,
#   parte na primeira tabela filha a entrar antes da mae.
$passos = @(
    @{
        Nome      = 'roles.sql'
        Descricao = 'papeis'
        Exe       = $pgDumpAll
        Args      = @('--roles-only', '--no-role-passwords')
        ArgsCli   = @('--role-only')
    },
    @{
        Nome      = 'schema.sql'
        Descricao = 'schema (RLS, etc)'
        Exe       = $pgDump
        Args      = @('--schema-only', '--schema=public')
        ArgsCli   = @()
    },
    @{
        Nome      = 'dados.sql'
        Descricao = 'dados + contas'
        Exe       = $pgDump
        Args      = @('--data-only', '--schema=public', '--schema=auth', '--disable-triggers')
        ArgsCli   = @('--data-only', '--use-copy')
    }
)

foreach ($passo in $passos) {
    $caminho = Join-Path $destino $passo.Nome
    Write-Host ("  {0,-22} " -f $passo.Descricao) -NoNewline

    if ($modo -eq 'pgdump') {
        $argumentos = @('--dbname', $ligacao, '--quote-all-identifiers', '-f', $caminho) + $passo.Args
        & $passo.Exe @argumentos | Out-Null
    }
    else {
        $argumentos = @('--yes', 'supabase', 'db', 'dump', '--db-url', $ligacao, '-f', $caminho) + $passo.ArgsCli
        & npx @argumentos | Out-Null
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "FALHOU" -ForegroundColor Red
        Write-Host ""
        Write-Host "O dump de '$($passo.Descricao)' devolveu o codigo $LASTEXITCODE." -ForegroundColor Red
        Write-Host "A copia esta INCOMPLETA. Nao apliques nada em producao." -ForegroundColor Red
        exit 1
    }

    # Um ficheiro vazio conta como falha: e exatamente a copia que parece
    # existir e nao serve para nada no dia em que for precisa.
    $tamanho = (Get-Item $caminho).Length
    if ($tamanho -eq 0) {
        Write-Host "VAZIO" -ForegroundColor Red
        Write-Host ""
        Write-Host "O dump correu mas saiu vazio. A copia NAO e valida." -ForegroundColor Red
        exit 1
    }

    Write-Host ("OK  ({0:N0} KB)" -f ($tamanho / 1KB)) -ForegroundColor Green
}

Write-Host ""
Write-Host "Copia concluida." -ForegroundColor Green
Write-Host ""

if ($psql) {
    $comandoPsql = "`"$psql`""
}
else {
    $comandoPsql = 'psql'
    Write-Host "Nota: nao ha psql nesta maquina - esta copia ainda nao e restauravel." -ForegroundColor Yellow
    Write-Host "      Instala o PostgreSQL (ver o cabecalho deste ficheiro)." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Para restaurar (ordem: roles -> schema -> dados):"
Write-Host "  $comandoPsql `"<ligacao>`" -f `"$destino\roles.sql`""
Write-Host "  $comandoPsql `"<ligacao>`" -f `"$destino\schema.sql`""
Write-Host "  $comandoPsql `"<ligacao>`" -f `"$destino\dados.sql`""
Write-Host ""
Write-Host "Uma copia que nunca foi restaurada ainda nao e uma copia: ensaia o" -ForegroundColor Cyan
Write-Host "restauro num projeto Supabase novo antes de precisares dela a serio." -ForegroundColor Cyan
Write-Host ""
