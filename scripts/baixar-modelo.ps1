# Atalho local: chama scripts/baixar_modelo.py (stdlib pura — é o .py que roda dentro da imagem).
# Uso: .\scripts\baixar-modelo.ps1 [-Vertente obesidade|diabetes] [-Repo dono/repositorio] [-Url https://...]
param(
    [ValidateSet('obesidade', 'diabetes')]
    [string]$Vertente = 'obesidade',
    [string]$Repo = '',
    [string]$Url = ''
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
# Cada vertente tem o seu manifest (e o seu release); o padrão é o da obesidade, como sempre foi.
$manifesto = if ($Vertente -eq 'diabetes') { 'artifacts\diabetes\manifest.json' } else { 'artifacts\manifest.json' }
$argumentos = @((Join-Path $PSScriptRoot 'baixar_modelo.py'),
                '--manifesto', (Join-Path $raiz $manifesto),
                '--destino', (Join-Path $raiz 'models'))
if ($Repo) { $argumentos += @('--repo', $Repo) }
if ($Url) { $argumentos += @('--url', $Url) }
& python @argumentos
exit $LASTEXITCODE
