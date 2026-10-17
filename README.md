# Triagem Metabólica

> Os dados exibidos são fictícios e servem apenas para demonstração. Nenhum registro corresponde a uma pessoa real. Esta ferramenta é de triagem e não substitui avaliação clínica.

Repositório: `risco-metabolico` · caminho local de desenvolvimento: `D:\trabalhos\ds\risco-metabolico` · autor: **Vinícius Ventura**.

Um microserviço de machine learning que recebe 16 respostas sobre medidas corporais e hábitos e devolve, em milissegundos, a distribuição de probabilidade entre 7 faixas de composição corporal mais um risco metabólico acumulado. A saída **ordena prioridade de atenção**; ela não fecha diagnóstico.

Em volta do modelo: uma API FastAPI com contrato versionado, um front React com simulador, painel analítico, notebook de estudo renderizado e uma tela de monitoramento de deriva; um Postgres que guarda a base de origem e o log de predições; e o SQL do projeto (schema, agregados do painel, consultas de deriva) versionado em `sql/`.

> Este README é um esqueleto (Fase F0). As seções abaixo são preenchidas ao longo das fases do plano de execução e fechadas nas fases F17 e F18.

## Estado do projeto

| Fase | Entrega | Estado |
|---|---|---|
| F0 | Decisão de nome e bootstrap do monorepo | concluída |

## Sumário (a preencher)

1. O que é e o que não é (triagem, não diagnóstico)
2. Nota de dados fictícios — já no topo deste arquivo
3. Demonstração ao vivo e `/docs` da API
4. Capturas de tela
5. Métricas do modelo — vêm de `GET /api/v1/model/info`, nunca escritas à mão
6. Arquitetura
7. Como rodar local, sem credencial
8. Como retreinar
9. O que este projeto corrige do modelo herdado
10. Cold start e hibernação do banco
11. Fonte de dados e licença (`data/bruto/FONTE.md`)
12. Autoria
13. O que não está no repositório e por quê
14. Onde está o SQL
15. Limitações conhecidas
