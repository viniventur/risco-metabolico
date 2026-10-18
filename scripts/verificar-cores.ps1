# Portão de cor (seção ANCORA do plano, ADR 0010): nenhuma cor no front fora de
# frontend/src/shared/tema/tokens.css. Dois greps, porque um só não cobre o Tailwind:
#   1. cor literal em hex em *.ts, *.tsx e *.css fora de tokens.css;
#   2. a paleta utilitária padrão do Tailwind (bg-slate-800, text-zinc-500, ...), que não contém '#'.
# Uso: pwsh scripts/verificar-cores.ps1   (sai com 1 se achar alguma cor fora dos tokens)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$src = Join-Path $raiz 'frontend/src'

# Select-String NÃO tem -Recurse; e -Path com diretório não desce na árvore.
$achados = @(Get-ChildItem -LiteralPath $src -Recurse -Include *.tsx, *.ts, *.css |
    Where-Object { $_.Name -ne 'tokens.css' } |
    Select-String -Pattern '#[0-9a-fA-F]{3,8}\b')
$achadosTw = @(Get-ChildItem -LiteralPath $src -Recurse -Include *.tsx |
    Select-String -Pattern '(bg|text|border)-(slate|zinc|gray|neutral|stone|red|blue|green)-[0-9]{2,3}')

foreach ($a in $achados + $achadosTw) {
    Write-Host ('  {0}:{1}  {2}' -f $a.Path.Substring($raiz.Length + 1), $a.LineNumber, $a.Line.Trim())
}
if ($achados.Count -gt 0 -or $achadosTw.Count -gt 0) {
    Write-Host 'FALHA: cor fora dos tokens (frontend/src/shared/tema/tokens.css).' -ForegroundColor Red
    exit 1
}
Write-Host 'OK: todas as cores passam pelos tokens.' -ForegroundColor Green
exit 0
