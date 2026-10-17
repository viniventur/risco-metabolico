# ADR 0005 — Filtros do painel no servidor

**Data:** 2026-10-17 · **Estado:** aceita · **Fase:** F8

## Contexto

O painel tem 6 filtros multivalorados (nível, gênero, água, álcool, calóricos, histórico familiar) e cross-filter entre visuais. Duas opções: mandar a base inteira para o navegador e filtrar no cliente, ou filtrar no servidor e devolver só o agregado.

## Decisão

**Servidor — e servidor quer dizer FastAPI, não banco.** Os filtros viajam como query params repetíveis (`?nivel=Obesidade%20I&nivel=Obesidade%20II&genero=Feminino`) para `/painel/*` e `/registros`, são aplicados em memória sobre `base_painel.parquet` carregado no lifespan, e cada recorte é cacheado por `FiltroPainel` (imutável, normalizado) com `ETag` por resposta. O cliente só guarda o estado do filtro na **URL** (`nuqs`): painel se compartilha por link, e voltar/avançar vira desfazer de filtro.

Motivos: o payload por requisição fica constante e pequeno; a lógica de agregação existe uma vez (`dominio/agregados.py`), onde é testável contra o SQL (paridade); o domínio completo e a supressão por amostra mínima são decididos no servidor, não reimplementados em cada gráfico.

## O que não muda com a camada de dados

Esta decisão responde "cliente ou servidor?". A pergunta "servidor ou banco?" é respondida pelo ADR 0006: **nenhuma requisição de gráfico abre conexão com o Postgres**. O cross-filter dispara muitas leituras por interação e o produto precisa abrir inteiro com o banco frio ou pausado.

## Fronteira

Se a latência p95 de `/painel/*` passar de 150 ms, migrar para payload único no cliente **sem mudar a interface dos hooks** (`useFiltros` para a URL, `useAgregado(campo, metrica, filtros)` sobre TanStack Query).

## Consequências

- Validação de filtro no servidor: valor fora do domínio é 422 nomeando o filtro (`utils/filtros.py`).
- Os slicers mostram todas as opções do domínio global (`/dimensoes`), não só as sobreviventes ao filtro, com a contagem global.
- `/registros` ordena e pagina no servidor (`linha_origem` desempata, ordem estável), tamanho máximo 200.
