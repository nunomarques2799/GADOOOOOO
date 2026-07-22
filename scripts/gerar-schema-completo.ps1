<#
.SYNOPSIS
    Junta os schema*.sql num ficheiro só, pela ordem correta.

.DESCRIPTION
    Para levantar um ambiente novo do zero (o de testes, ou um substituto do de
    produção num dia mau) é preciso aplicar os 10 ficheiros de schema pela ordem
    certa. Dez colagens no SQL Editor é onde se salta um sem dar por isso.

    Este script gera `supabase/_completo.sql`, que se cola de UMA vez.

    Porque é que colar tudo junto é mais seguro, e não menos: o Postgres corre
    um lote de comandos enviado de uma vez como UMA transação implícita. Se
    algo falhar a meio, faz rollback de tudo e a base fica exatamente como
    estava. Dez colagens separadas são dez transações — falhar na sexta deixa a
    base num estado intermédio que não corresponde a versão nenhuma.
    (Isto só é verdade porque nenhum destes ficheiros usa `create index
    concurrently`, `alter type ... add value` ou `begin`/`commit` próprios.
    Se algum dia passar a usar, deixa de se poder juntar assim.)

    O ficheiro gerado é derivado — está no .gitignore. Regenera-o sempre que
    acrescentares um schema novo.

.EXAMPLE
    powershell scripts/gerar-schema-completo.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$raizRepo = Split-Path -Parent $PSScriptRoot
$pastaSupabase = Join-Path $raizRepo 'supabase'
$ficheiroOrdem = Join-Path $pastaSupabase 'ordem.txt'
$destino = Join-Path $pastaSupabase '_completo.sql'

if (-not (Test-Path $ficheiroOrdem)) {
    Write-Host "Falta o ficheiro supabase/ordem.txt." -ForegroundColor Red
    exit 1
}

# A ordem vem de ordem.txt e de mais lado nenhum: e a razao de ordem.txt
# existir. Um script com a lista escrita por dentro seria uma segunda copia da
# ordem, e duas copias divergem sempre.
$ficheiros = Get-Content $ficheiroOrdem |
    Where-Object { $_.Trim() -ne '' -and -not $_.Trim().StartsWith('#') } |
    ForEach-Object { $_.Trim() }

# Um ficheiro de schema que exista na pasta mas nao esteja em ordem.txt e o
# erro silencioso que este script existe para apanhar: o ambiente novo sairia
# sem ele e a diferenca so aparecia semanas depois, num ecra que nao carrega.
$naPasta = Get-ChildItem (Join-Path $pastaSupabase 'schema*.sql') | ForEach-Object { $_.Name }
$emFalta = $naPasta | Where-Object { $ficheiros -notcontains $_ }
if ($emFalta) {
    Write-Host ""
    Write-Host "Ha schema*.sql que NAO estao em ordem.txt:" -ForegroundColor Red
    $emFalta | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Acrescenta-os a ordem.txt (e a tabela do MIGRACOES.md) e corre de novo."
    exit 1
}

$saida = New-Object System.Text.StringBuilder
$carimbo = Get-Date -Format 'yyyy-MM-dd HH:mm'

[void]$saida.AppendLine("-- ==================================================================")
[void]$saida.AppendLine("-- GERADO por scripts/gerar-schema-completo.ps1 em $carimbo")
[void]$saida.AppendLine("-- NAO EDITAR A MAO. Editar os schema*.sql e voltar a gerar.")
[void]$saida.AppendLine("--")
[void]$saida.AppendLine("-- Colar TUDO de uma vez no SQL Editor do Supabase. Corre como uma")
[void]$saida.AppendLine("-- transacao unica: ou aplica tudo, ou nao aplica nada.")
[void]$saida.AppendLine("-- ==================================================================")
[void]$saida.AppendLine("")

$n = 0
foreach ($ficheiro in $ficheiros) {
    $n++
    $caminho = Join-Path $pastaSupabase $ficheiro
    if (-not (Test-Path $caminho)) {
        Write-Host "ordem.txt refere '$ficheiro', que nao existe na pasta." -ForegroundColor Red
        exit 1
    }

    [void]$saida.AppendLine("")
    [void]$saida.AppendLine("-- ##################################################################")
    [void]$saida.AppendLine("-- ## $n/$($ficheiros.Count) - $ficheiro")
    [void]$saida.AppendLine("-- ##################################################################")
    [void]$saida.AppendLine("")
    [void]$saida.AppendLine((Get-Content $caminho -Raw))

    Write-Host ("  {0,2}. {1}" -f $n, $ficheiro) -ForegroundColor Gray
}

# UTF8 sem BOM: o BOM viaja no copiar-colar e o Postgres rejeita-o como um
# caracter invalido antes do primeiro comando.
$semBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($destino, $saida.ToString(), $semBom)

$kb = (Get-Item $destino).Length / 1KB
Write-Host ""
Write-Host ("Gerado: supabase/_completo.sql  ({0:N0} KB, {1} ficheiros)" -f $kb, $ficheiros.Count) -ForegroundColor Green
Write-Host ""
