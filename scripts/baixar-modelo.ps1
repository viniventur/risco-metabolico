# Atalho local: chama scripts/baixar_modelo.py (stdlib pura — é o .py que roda dentro da imagem).
# Uso: .\scripts\baixar-modelo.ps1 [-Repo dono/repositorio] [-Url https://...]
param(
    [string]$Repo = '',
    [string]$Url = ''
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$argumentos = @((Join-Path $PSScriptRoot 'baixar_modelo.py'),
                '--manifesto', (Join-Path $raiz 'artifacts\manifest.json'),
                '--destino', (Join-Path $raiz 'models'))
if ($Repo) { $argumentos += @('--repo', $Repo) }
if ($Url) { $argumentos += @('--url', $Url) }
& python @argumentos
exit $LASTEXITCODE
