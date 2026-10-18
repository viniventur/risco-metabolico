# Portão de CI, sem credencial (plano, §4.3.4): falha se frontend/dist/ contiver qualquer
# indício de credencial ou de host de banco. Um VITE_* é literalmente colado no bundle no build —
# não é segredo, é texto. Roda depois de `npm run build` e no aceite de F17.
param([string]$Dist = '')

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
if (-not $Dist) { $Dist = Join-Path $raiz 'frontend\dist' }
if (-not (Test-Path -LiteralPath $Dist)) { Write-Host "FALHA: $Dist nao existe (rode npm run build antes)."; exit 2 }

# Um JWT sao dois blocos base64url que comecam por 'eyJ' ({"...) separados por ponto: header.payload.
# So 'eyJ' solto nao serve de criterio — os dados binarios das figuras Plotly do modulo Estudos
# (public/study/*.json, campo "bdata") sao base64 e contem a sequencia por acaso.
$padrao = '(?i)(supabase|service_role|postgres://|postgresql://|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,})'
$arquivos = Get-ChildItem -LiteralPath $Dist -Recurse -File |
    Where-Object { $_.Extension -in '.js', '.mjs', '.css', '.html', '.json', '.map', '.txt' }
$achados = @($arquivos | Select-String -Pattern $padrao |
    ForEach-Object { "{0}:{1}  {2}" -f $_.Path.Substring($raiz.Length + 1), $_.LineNumber, $_.Line.Trim().Substring(0, [Math]::Min(120, $_.Line.Trim().Length)) })

if ($achados.Count -gt 0) {
    Write-Host 'FALHA: possivel credencial ou host de banco dentro do bundle publicado.' -ForegroundColor Red
    $achados | ForEach-Object { Write-Host ('  ' + $_) }
    exit 1
}
Write-Host ("OK: nenhuma credencial em {0} arquivo(s) de {1}." -f $arquivos.Count, $Dist) -ForegroundColor Green
exit 0
