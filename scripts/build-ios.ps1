<#
.SYNOPSIS
    Constrói a app iOS no EAS autenticando-se com a App Store Connect API Key.

.DESCRIPTION
    A conta Apple é do colega (equipa 8785V5WL8W, do tipo Individual). Numa
    conta Individual só o Account Holder consegue gerar credenciais de
    assinatura, por isso o nosso Apple ID nunca serve para fazer login no
    portal de programador — ver CONSTRUIR_iOS.md.

    A saída é a API Key: autentica-se sem Apple ID e sem código de dois passos,
    e não morre quando o dono da conta mudar a palavra-passe.

    O .p8 vive FORA do repositório, em ~/.appstoreconnect/private_keys/, e o
    Key ID sai do próprio nome do ficheiro (a Apple chama-lhe AuthKey_<ID>.p8)
    — assim há um valor a menos para copiar à mão e enganar.

    Trabalha sobre a pasta ONDE É CORRIDO, não sobre onde o ficheiro está. É de
    propósito: o script exige o branch `main`, e enquanto ele só existir no
    `dev` o `git checkout main` apagava-o a meio da execução. Guarda-se uma
    cópia fora do repositório e corre-se essa, de dentro do repositório:

        Copy-Item scripts/build-ios.ps1 $env:USERPROFILE\.appstoreconnect\
        git checkout main
        powershell $env:USERPROFILE\.appstoreconnect\build-ios.ps1 -IssuerId "..." -Enviar

    Quando este ficheiro chegar ao `main` por um merge normal, passa a poder
    correr-se de `scripts/` como os outros.

.EXAMPLE
    powershell $env:USERPROFILE\.appstoreconnect\build-ios.ps1 -IssuerId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

.EXAMPLE
    powershell $env:USERPROFILE\.appstoreconnect\build-ios.ps1 -IssuerId "..." -Enviar
    Constrói e, no fim, envia para o TestFlight.
#>

[CmdletBinding()]
param(
    [string]$IssuerId = $env:EXPO_ASC_ISSUER_ID,
    [switch]$Enviar,
    [switch]$IgnorarBranch
)

$ErrorActionPreference = 'Stop'

# A pasta onde ESTAMOS, nao a pasta do ficheiro — ver .DESCRIPTION.
$raizRepo = (Get-Location).Path
$pastaChaves = Join-Path $env:USERPROFILE '.appstoreconnect\private_keys'

if (-not (Test-Path (Join-Path $raizRepo 'eas.json'))) {
    throw "Corre isto de dentro do repositorio (a pasta que tem o eas.json). Estas em $raizRepo."
}

# A equipa e o registo da app no App Store Connect nao mudam.
$idEquipa = '8785V5WL8W'
$tipoEquipa = 'INDIVIDUAL'
$idAppStore = '6799063195'

# ------------------------------------------------------------------
# 1. Recusar fora do main
# ------------------------------------------------------------------
# Todos os perfis do eas.json trazem as chaves de PRODUCAO e nenhum define
# EXPO_PUBLIC_AMBIENTE=dev, por isso um build daqui liga-se a base de dados do
# criador sem a faixa roxa a avisar. Construir a partir do dev poe codigo por
# testar a escrever nos registos reais dele. Ver AMBIENTES.md.
$branch = (git -C $raizRepo branch --show-current).Trim()
if ($branch -ne 'main' -and -not $IgnorarBranch) {
    throw "Estas no branch '$branch'. Este build liga-se a base de dados de PRODUCAO e nao mostra a faixa roxa — constroi-se a partir do 'main'. Corre 'git checkout main' (ou passa -IgnorarBranch se sabes o que estas a fazer)."
}

$sujo = git -C $raizRepo status --porcelain
if ($sujo) {
    throw "Tens alteracoes por commitar. O EAS envia o estado COMMITADO do git, por isso o que nao esta commitado nao entra no build."
}

# ------------------------------------------------------------------
# 2. Encontrar a chave e tirar-lhe o Key ID do nome
# ------------------------------------------------------------------
if (-not (Test-Path $pastaChaves)) {
    throw "Falta a pasta $pastaChaves. Poe la o ficheiro AuthKey_*.p8 descarregado do App Store Connect."
}

$chaves = @(Get-ChildItem -Path $pastaChaves -Filter 'AuthKey_*.p8' -File)
if ($chaves.Count -eq 0) {
    throw "Nenhum AuthKey_*.p8 em $pastaChaves. App Store Connect -> Users and Access -> Integrations -> Team Keys -> +, papel Admin, e descarrega (so da uma vez)."
}
if ($chaves.Count -gt 1) {
    throw "Ha mais do que uma chave em $pastaChaves. Deixa la so a que esta em uso — nao ha como adivinhar qual delas o EAS deve usar."
}

$chave = $chaves[0]
$keyId = $chave.BaseName -replace '^AuthKey_', ''

if (-not $IssuerId) {
    throw "Falta o Issuer ID. Esta no topo da pagina Integrations do App Store Connect (um UUID com hifenes), e e o mesmo para todas as chaves da conta."
}

# ------------------------------------------------------------------
# 3. Construir
# ------------------------------------------------------------------
$env:EXPO_ASC_API_KEY_PATH = $chave.FullName
$env:EXPO_ASC_KEY_ID = $keyId
$env:EXPO_ASC_ISSUER_ID = $IssuerId
$env:EXPO_APPLE_TEAM_ID = $idEquipa
$env:EXPO_APPLE_TEAM_TYPE = $tipoEquipa

Write-Host ""
Write-Host "  Chave   $($chave.Name)  (Key ID $keyId)"
Write-Host "  Equipa  $idEquipa ($tipoEquipa)"
Write-Host "  Branch  $branch"
Write-Host ""

Push-Location $raizRepo
try {
    npx eas build --platform ios --profile production
    if ($LASTEXITCODE -ne 0) {
        throw "O build falhou (codigo $LASTEXITCODE). Se caiu em poucos segundos, e autenticacao ou quota — nao chegou a compilar e nao gastou build."
    }

    if ($Enviar) {
        npx eas submit --platform ios --profile production
        if ($LASTEXITCODE -ne 0) {
            throw "O envio falhou (codigo $LASTEXITCODE). O build esta feito — podes repetir so o submit."
        }
        Write-Host ""
        Write-Host "Enviado. Aparece no TestFlight (app $idAppStore) 10-15 min depois, o tempo de a Apple processar o binario."
    } else {
        Write-Host ""
        Write-Host "Para enviar para o TestFlight: powershell scripts/build-ios.ps1 -IssuerId '$IssuerId' -Enviar"
        Write-Host "(ou so o envio: npx eas submit --platform ios --profile production)"
    }
} finally {
    Pop-Location
}
