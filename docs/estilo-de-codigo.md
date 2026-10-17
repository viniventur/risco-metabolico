# Estilo de código

O backend novo é escrito **no mesmo estilo dos arquivos legados** — e isso é verificável, não um parágrafo de boas intenções: a configuração do `ruff` em `backend/pyproject.toml` (`line-length = 100`, `quote-style = "double"`, `select = ["E","F","I","UP","ANN","D"]`, docstrings na convenção Google) é o portão de §10.8 e roda no CI.

## 1. Herdado do legado

| Traço | Origem |
|---|---|
| Type hints em toda função pública: `def engineer_features(df: pd.DataFrame) -> pd.DataFrame:` | `app.py:24` |
| `df = df.copy()` como **primeira linha** de toda função de transformação | `app.py:26` |
| Comentários numerados em português: `# 1. Ajuste da Feature Engineering` | `app.py:24`, notebook célula 14 |
| f-strings com `:.1f` para percentual e `round(x, 2)` para IMC | `app.py:95`, `app.py:214` |
| `pathlib.Path` para todo caminho, nunca concatenação de string | `app.py:56` |
| Dicionário de tradução com sufixo `_map`; helper privado com prefixo `_` | `app.py:101-213` (`_select_mapped`) |
| Texto em português **acentuado** dentro do código (docstrings, comentários, mensagens) | `app.py` (`# Cálculo do IMC`, `# Necessário para carregar modelos`) |

## 2. Convenções novas

- **Idioma híbrido, por camada.** Português para domínio, interface e saída ao usuário (`montar_relatorio_html`, `calcular_imc`, `classificar_imc`, `prob_risco`, `classe_final`); inglês para infraestrutura e ML (`load_artifact`, `engineer_features`, `pipeline`, `label_encoder`). Nas rotas, o mesmo critério: domínio em português (`/predicoes`, `/registros`, `/painel`, `/monitoramento`), infraestrutura em inglês (`/health`, `/ready`, `/model/info`, `/metadata`).
- `snake_case` para funções e variáveis, `PascalCase` só para classes, `UPPER_SNAKE` para constantes de módulo.
- Docstring de **uma linha**, em português, explicando o **porquê técnico** — não o que o nome já diz.
- Imports em três blocos (stdlib, terceiros, locais), ordenados pelo `ruff` (`I`).
- `from __future__ import annotations` em todo módulo.
- Arquivos em **UTF-8 sem BOM**. O CI confere: `python -c "import pathlib,sys; sys.exit(any(p.read_bytes().startswith(b'\xef\xbb\xbf') for p in pathlib.Path('backend').rglob('*.py')))"`.
- Nenhuma constante de módulo duplica uma variável de ambiente: o valor vive em `app/config.py` (`CONFIG.limite_lote`, `CONFIG.log_predicao_fila_max`, …) e é lido de lá. Três fontes para o mesmo número divergem em uma semana.
- Nenhuma métrica, largura de modelo ou hash escrito à mão: tudo vem do manifest.
- Caminhos resolvidos a partir da raiz do repositório (`Path(__file__).resolve().parents[n]`), nunca do diretório de trabalho.

## 3. Desvios deliberados do legado

| Sai | Por quê |
|---|---|
| `warnings.filterwarnings('ignore')` global | Esconde exatamente o tipo de aviso (`InconsistentVersionWarning`) que revelou as divergências do artefato. |
| `sys.modules["__main__"].engineer_features = ...` | O artefato novo não depende de nome em `__main__`: nenhuma função anônima é serializada. |
| `dill` | O pipeline é serializado com `joblib`, só com objetos importáveis. |
| O `except Exception` que reescrevia `pipeline.steps` em silêncio | Falha de carga é 503 explícito (`ArtefatoIndisponivel`), nunca um fallback mudo. |
| `handle_unknown='ignore'` | `'error'` com `categories=` explícito; categoria desconhecida vira 422 nomeando campo e valor. |
| `values.get(...)` e campos opcionais no formulário | `extra="forbid"` e enums fechados: um typo vira 422, não silêncio. |

## 4. Portão

```powershell
Push-Location backend
uv run ruff check app tests
uv run ruff format --check app tests
uv run mypy app
Pop-Location
```

Nos testes, `D1` (docstring obrigatória) e `ANN` (anotações) são relaxados por `per-file-ignores`; todo o resto vale igual.
