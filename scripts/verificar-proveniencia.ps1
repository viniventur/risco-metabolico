# Falha se qualquer termo proibido (lista negra, plano §3.3) aparecer no conteúdo
# ou no nome de arquivo do repositório, ou se um nome de autor da citação de um
# data/bruto/**/FONTE.md tiver vazado para qualquer outro arquivo.
#
# Uso: .\scripts\verificar-proveniencia.ps1 [-Arquivo <caminho>]
#   sem -Arquivo: varre o repositório inteiro (pre-commit, CI, uso manual)
#   com -Arquivo:  varre só aquele arquivo (hook commit-msg: a mensagem de commit)
#
# O regex vive em UM lugar só, scripts/padrao-proveniencia.txt (linha 1: padrão
# amplo, insensível a caixa; linha 2: padrão estrito, sensível a caixa e com
# fronteiras). backend/tests/test_proveniencia.py lê o mesmo arquivo.
param([string]$Arquivo)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$linhas = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'padrao-proveniencia.txt') -Encoding utf8 |
    Where-Object { $_.Trim() -ne '' }
if ($linhas.Count -lt 2) { Write-Host 'FALHA: padrao-proveniencia.txt precisa de duas linhas.'; exit 2 }
$padrao        = $linhas[0]
$padraoEstrito = $linhas[1]

# Diretórios que nunca entram na varredura (infraestrutura, não conteúdo).
$dirsIgnorados = @('.git', 'node_modules', '.venv', 'dist', '__pycache__', '.pytest_cache',
                   '.ruff_cache', '.mypy_cache', 'htmlcov', '.vite', 'playwright-report',
                   'test-results', '.ipynb_checkpoints')

# As fontes do próprio padrão e a documentação de auditoria ficam fora da
# varredura de CONTEÚDO — senão o script reprova a si mesmo e o hook trava todo
# commit. Os nomes desses arquivos continuam sendo conferidos.
$conteudoIgnorado = @(
    'verificar-proveniencia\.ps1$', 'padrao-proveniencia\.txt$',
    'test_proveniencia\.py$', 'docs[\\/]auditoria-do-legado\.md$',
    'PLANO-.*\.md$'
)
# Binários: Select-String sobre bytes gera casamento espúrio (ex.: 'f4' dentro de
# um PNG). O NOME deles continua sendo conferido na varredura de nomes.
$binarios = '\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|eot|pdf|parquet|pkl|zip|gz|pyc|xlsx|pbix)$'

function Listar-Arquivos([string]$dir) {
    foreach ($item in Get-ChildItem -LiteralPath $dir -Force) {
        if ($item.PSIsContainer) {
            if ($dirsIgnorados -contains $item.Name) { continue }
            Listar-Arquivos $item.FullName
        } else {
            $item
        }
    }
}

function Relativo([string]$caminho) {
    return $caminho.Substring($raiz.Length).TrimStart('\', '/')
}

if ($Arquivo) {
    $alvosNome     = @()
    $alvosConteudo = @(Get-Item -LiteralPath $Arquivo)
} else {
    $alvosNome     = @(Listar-Arquivos $raiz)
    $alvosConteudo = @($alvosNome | Where-Object {
        $rel = Relativo $_.FullName
        -not ($conteudoIgnorado | Where-Object { $rel -match $_ }) -and ($_.Name -notmatch $binarios)
    })
}

# NÃO sair cedo: as ocorrências são ACUMULADAS e o script só decide no fim.
# Um `exit 0` no meio tornaria a varredura de nomes abaixo inalcançável — e ela
# é a única barreira que impede a citação de FONTE.md de vazar (§3.2).
$falhas = @()
if ($alvosConteudo.Count -gt 0) {
    $falhas += @($alvosConteudo | Select-String -Pattern $padrao |
        ForEach-Object { "conteudo: {0}:{1}  {2}" -f (Relativo $_.Path), $_.LineNumber, $_.Line.Trim() })
    $falhas += @($alvosConteudo | Select-String -Pattern $padraoEstrito -CaseSensitive |
        ForEach-Object { "conteudo: {0}:{1}  {2}" -f (Relativo $_.Path), $_.LineNumber, $_.Line.Trim() })
}
# Nomes: todo componente do caminho relativo (pastas e arquivo).
$falhas += @($alvosNome |
    Where-Object { $rel = Relativo $_.FullName; $rel -match $padrao -or $rel -cmatch $padraoEstrito } |
    ForEach-Object { "nome:     {0}" -f (Relativo $_.FullName) })

# ---- Segundo bloco: nomes de terceiros não vazam do bloco de citação (§3.2) ----
# Os nomes de pessoa ficam no sub-bloco <!-- autores-inicio --> ... <!-- autores-fim -->
# dentro do bloco de citação. Extrair tokens do bloco de citação INTEIRO reprovaria
# palavras do título do conjunto ("Dataset", "Obesity", "Learning") em todo arquivo.
# Uma base, um FONTE.md: data/bruto/FONTE.md (obesidade) e data/bruto/diabetes/FONTE.md. Os nomes
# de cada um só valem NELE — o FONTE.md da outra base também conta como "outro arquivo".
$fontes = @(Get-ChildItem -LiteralPath (Join-Path $raiz 'data\bruto') -Recurse -File -Filter 'FONTE.md')
if ($fontes.Count -eq 0) { $falhas += 'citacao: nenhum FONTE.md em data/bruto' }
foreach ($fonte in $fontes) {
    $relFonte = Relativo $fonte.FullName
    $texto = Get-Content -LiteralPath $fonte.FullName -Raw -Encoding utf8
    $bloco = [regex]::Match($texto, '(?s)citacao-inicio -->(.*?)<!-- citacao-fim').Groups[1].Value
    $autores = [regex]::Match($bloco, '(?s)autores-inicio -->(.*?)<!-- autores-fim').Groups[1].Value
    if ($bloco.Trim() -eq '' -or $bloco -match 'PENDENTE') {
        $falhas += "citacao: o bloco de citacao de $relFonte esta vazio ou PENDENTE"
    }
    # Tokens capitalizados de 3+ letras: os nomes próprios dos autores.
    $tokens = [regex]::Matches($autores, '\b\p{Lu}\p{L}{2,}\b') |
        ForEach-Object { $_.Value } | Sort-Object -Unique
    if ($Arquivo) { $outros = $alvosConteudo } else {
        # O próprio FONTE.md sai da varredura: é o único lugar onde a exceção dele vale.
        $outros = @($alvosConteudo | Where-Object { $_.FullName -ne $fonte.FullName })
    }
    foreach ($token in $tokens) {
        if ($outros.Count -eq 0) { break }
        $falhas += @($outros | Select-String -Pattern "\b$([regex]::Escape($token))\b" -CaseSensitive |
            ForEach-Object { "nome de terceiro: {0}:{1}  ({2})" -f (Relativo $_.Path), $_.LineNumber, $token })
    }
}

if ($falhas.Count -gt 0) {
    Write-Host 'FALHA: termos proibidos encontrados.' -ForegroundColor Red
    $falhas | ForEach-Object { Write-Host ('  ' + $_) }
    exit 1
}

Write-Host 'OK: nenhum termo proibido.' -ForegroundColor Green
exit 0
