# ADR 0001 — Nome do projeto

**Data:** 2026-10-17 · **Estado:** aceita · **Fase:** F0

## Contexto

O plano de execução usava "Risco Metabólico" como nome de trabalho e o slug `risco-metabolico` em todos os caminhos. Três candidatos foram considerados, separando **nome de produto** (interface, título do README, aba do navegador) de **nome de repositório** (slug técnico: URL, import, caminho):

| # | Produto | Repositório | A favor | Contra |
|---|---|---|---|---|
| 1 | Risco Metabólico | `risco-metabolico` | descreve a saída do modelo; já ancora todos os caminhos | "risco" soa a diagnóstico |
| 2 | Triagem Metabólica | `triagem-metabolica` | o limite de escopo vira identidade | slug novo quebra caminhos e a simetria com o legado |
| 3 | Sinal Metabólico | `sinal-metabolico` | nome de produto, envelhece bem | vago sem ler o README |

## Decisão

**Par misto:** repositório **`risco-metabolico`**, produto **"Triagem Metabólica"**.

O slug é infraestrutura e ganha em ser estável: é a âncora de cada caminho do plano, do nome da pasta legada (`risco-metabolico-legado`) e dos comandos de deploy. O nome de produto é texto de interface e precisa carregar o limite de escopo: "Triagem Metabólica" diz que a saída ordena prioridade, não fecha diagnóstico.

## Critério de desempate, aplicado

O plano pedia conferir colisão do slug no GitHub e no npm antes do `git init`:

- `gh search repos risco-metabolico` — nenhum repositório com esse nome (os dois resultados devolvidos têm outro nome e só casam por descrição);
- `npm view risco-metabolico` — pacote inexistente (404);
- `gh repo view <conta-do-autor>/risco-metabolico` — não existe.

Sem colisão, vale a recomendação: `risco-metabolico`.

## Onde o nome aparece

O nome de produto aparece em exatamente três arquivos (`README.md`, `frontend/index.html`, `backend/app/config.py`) e o slug no nome da pasta e no `manifest.json`. Trocar o nome custa esses arquivos e um `Rename-Item`. A decisão é reversível e barata.

## Consequências

- O repositório nasce em `D:\trabalhos\ds\risco-metabolico`, **irmão** da pasta de referência e fora dela, para que nenhum caminho absoluto em saída de célula, log de treino ou campo `ambiente` do manifest carregue termo da lista negra.
- A branch principal é `main`; nem o caminho nem o nome da branch casam com a lista negra (§3.3 do plano).
