<#
.SYNOPSIS
    Abre a app Windows (Electron) contra a base de dados de TESTES.

.DESCRIPTION
    Constrói o bundle web com as variáveis do `.env` (que apontam para o
    projeto Supabase de testes), copia-o para o desktop, marca-o como sendo de
    testes e abre a app.

    NÃO instala nada. Não cria atalho, não mexe no "Gestão de Gado" que já
    tens instalado, não se auto-atualiza. É a mesma janela e o mesmo
    comportamento da app a sério — só que descartável.

    A app de testes corre com nome próprio ("Gestao de Gado (DEV)") e noutra
    porta, por isso tem armazenamento SEPARADO do da app instalada. Sem essa
    separação as duas partilhariam o localStorage, incluindo a fila de escritas
    por sincronizar — e os registos de teste acabavam na base de dados real.
    Ver a secção "Ambiente" em desktop/main.js.

    Podes ter as duas abertas ao mesmo tempo para comparar.

.EXAMPLE
    powershell scripts/desktop-dev.ps1

.EXAMPLE
    powershell scripts/desktop-dev.ps1 -SoConstruir
    Constrói e marca o bundle, mas não abre a app.
#>

[CmdletBinding()]
param(
    [switch]$SoConstruir
)

$ErrorActionPreference = 'Stop'

$raizRepo = Split-Path -Parent $PSScriptRoot
$ficheiroEnv = Join-Path $raizRepo '.env'
$pastaDist = Join-Path $raizRepo 'dist'
$pastaDesktop = Join-Path $raizRepo 'desktop'
$pastaWeb = Join-Path $pastaDesktop 'web'

# ------------------------------------------------------------------
# 1. Recusar se o .env nao apontar para testes
# ------------------------------------------------------------------
# Este e o unico passo que nao se pode saltar. Sem ele, um .env apontado a
# producao produzia uma app ligada aos dados do criador a ostentar a
# identidade "DEV" — exatamente a confusao que tudo isto existe para evitar.
if (-not (Test-Path $ficheiroEnv)) {
    Write-Host "Nao existe .env na raiz do repositorio." -ForegroundColor Red
    Write-Host "Copia o .env.example e preenche com as chaves do Supabase de testes."
    exit 1
}

$ambiente = $null
$urlSupabase = '(nao definido)'
foreach ($linha in (Get-Content $ficheiroEnv)) {
    if ($linha -match '^\s*EXPO_PUBLIC_AMBIENTE\s*=\s*(.+?)\s*$') { $ambiente = $Matches[1].Trim('"').Trim("'") }
    if ($linha -match '^\s*EXPO_PUBLIC_SUPABASE_URL\s*=\s*(.+?)\s*$') { $urlSupabase = $Matches[1].Trim('"').Trim("'") }
}

if ($ambiente -ne 'dev') {
    Write-Host ""
    Write-Host "RECUSADO: o .env nao esta em ambiente de testes." -ForegroundColor Red
    Write-Host ""
    Write-Host "  EXPO_PUBLIC_AMBIENTE = $ambiente"
    Write-Host "  EXPO_PUBLIC_SUPABASE_URL = $urlSupabase"
    Write-Host ""
    Write-Host "Isto construiria uma app ligada a PRODUCAO com aparencia de app"
    Write-Host "de testes. Poe EXPO_PUBLIC_AMBIENTE=dev no .env e tenta de novo."
    Write-Host "Ver AMBIENTES.md."
    exit 1
}

Write-Host ""
Write-Host "Ambiente de testes confirmado" -ForegroundColor Cyan
Write-Host "  Supabase: $urlSupabase"
Write-Host ""

# ------------------------------------------------------------------
# 2. Construir o bundle web
# ------------------------------------------------------------------
Write-Host "A construir o bundle web (demora 1-2 minutos)..." -ForegroundColor Gray
Push-Location $raizRepo
try {
    & npx expo export --platform web | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "O `expo export` falhou." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

# ------------------------------------------------------------------
# 3. Copiar para o desktop e MARCAR como testes
# ------------------------------------------------------------------
if (Test-Path $pastaWeb) { Remove-Item $pastaWeb -Recurse -Force }
Copy-Item $pastaDist $pastaWeb -Recurse

# A marca viaja com o bundle. E o que faz o main.js dar-lhe nome e porta
# proprios, e nunca procurar atualizacoes no Release de producao.
$marca = '{ "ambiente": "dev" }'
[System.IO.File]::WriteAllText((Join-Path $pastaWeb 'ambiente.json'), $marca, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Bundle pronto e marcado como testes." -ForegroundColor Green

if ($SoConstruir) {
    Write-Host ""
    Write-Host "Para abrir: powershell scripts/desktop-dev.ps1"
    exit 0
}

# ------------------------------------------------------------------
# 4. Abrir a app
# ------------------------------------------------------------------
if (-not (Test-Path (Join-Path $pastaDesktop 'node_modules'))) {
    Write-Host "A instalar as dependencias do desktop (so da primeira vez)..." -ForegroundColor Gray
    Push-Location $pastaDesktop
    try { & npm ci | Out-Null } finally { Pop-Location }
}

Write-Host ""
Write-Host "A abrir 'Gestao de Gado (DEV)'. Fecha a janela para voltar aqui." -ForegroundColor Cyan
Write-Host ""

Push-Location $pastaDesktop
try { & npx electron . } finally { Pop-Location }
