# Materializa artifacts/distribuicao_treino.json nas três tabelas de referência de deriva
# (operacao.feature_catalogo, operacao.distribuicao_treino_numerica, operacao.distribuicao_treino_faixa).
# Idempotente: TRUNCATE + INSERT numa transação. Roda depois de todo treino e de todo deploy que
# troque o artefato (plano, §6.8.4).
#
# Assinatura: -BancoUrl <dsn>, com default $env:BANCO_URL — existe UMA variável de DSN em todo o
# projeto; quem escolhe o ambiente (compose local ou pooler publicado) é quem define BANCO_URL.
# A implementação é única e vive em backend/app/treino/distribuicao.py; este script é o atalho.
param(
    [string]$BancoUrl = $env:BANCO_URL,
    [string]$Json = ''
)

$ErrorActionPreference = 'Stop'
if (-not $BancoUrl) { Write-Host 'FALHA: informe -BancoUrl ou defina $env:BANCO_URL.'; exit 2 }

$raiz = Split-Path -Parent $PSScriptRoot
$argumentos = @('run', '--extra', 'treino', 'python', '-m', 'app.treino.distribuicao', '--carregar', '--banco-url', $BancoUrl)
if ($Json) { $argumentos += @('--json', (Resolve-Path $Json).Path) }

Push-Location (Join-Path $raiz 'backend')
try {
    & uv @argumentos
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
