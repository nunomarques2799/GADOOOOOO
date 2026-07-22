<#
.SYNOPSIS
    Cópia de segurança de uma base de dados Supabase da Gestão de Gado.

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
      schema.sql  — tabelas, políticas de RLS, funções, triggers
      dados.sql   — o conteúdo das tabelas (COPY, rápido de restaurar)

.PARAMETER Ambiente
    'prod' ou 'dev'. Decide de que base se faz a cópia e para que pasta vai.

.EXAMPLE
    powershell scripts/backup.ps1 -Ambiente prod

.NOTES
    A ligação vem de uma variável de ambiente ou do ficheiro `.env.backup` na
    raiz do repositório (que está no .gitignore — contém a palavra-passe da
    base de dados e NUNCA pode ser committado):

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
# 2. Pasta de destino — FORA do repositorio
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
Write-Host ""

# ------------------------------------------------------------------
# 3. Os tres dumps
# ------------------------------------------------------------------
$passos = @(
    @{ Nome = 'roles.sql';  Descricao = 'papeis';            Args = @('--role-only') },
    @{ Nome = 'schema.sql'; Descricao = 'schema (RLS, etc)'; Args = @() },
    @{ Nome = 'dados.sql';  Descricao = 'dados';             Args = @('--data-only', '--use-copy') }
)

foreach ($passo in $passos) {
    $caminho = Join-Path $destino $passo.Nome
    Write-Host ("  {0,-22} " -f $passo.Descricao) -NoNewline

    $argumentos = @('supabase', 'db', 'dump', '--db-url', $ligacao, '-f', $caminho) + $passo.Args
    & npx @argumentos | Out-Null

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
Write-Host "Para restaurar (ordem: roles -> schema -> dados):"
Write-Host "  psql `"<ligacao>`" -f `"$destino\roles.sql`""
Write-Host "  psql `"<ligacao>`" -f `"$destino\schema.sql`""
Write-Host "  psql `"<ligacao>`" -f `"$destino\dados.sql`""
Write-Host ""
