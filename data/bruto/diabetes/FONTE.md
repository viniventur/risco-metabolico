# Fonte do conjunto de dados — vertente diabetes

`cdc_diabetes_health_indicators.csv` é uma **cópia literal** (253.680 registros × 23 colunas, 13.494.568 bytes, quebras de linha CRLF, sha256 `9f71fda9d4ae5f4878c99b9233b6a16accfa9a17c194116a6b78100540934964`) do arquivo `data.csv` do conjunto descrito abaixo, baixado do endereço estático do repositório público (`https://archive.ics.uci.edu/static/public/891/data.csv`). É o **insumo de semeadura** de `dados.registros_diabetes` (`python -m app.diabetes.dados.seed`): o seed grava o hash deste arquivo e o hash deste `FONTE.md` em `operacao.carga_fonte` e recusa semear se o bloco de citação estiver vazio ou `PENDENTE`. O `.gitattributes` marca o CSV como `-text`: nenhum clone converte as quebras de linha, e o hash acima vale em qualquer máquina.

Ao contrário da base da vertente de obesidade, estes registros são **respostas reais**: cada linha é uma pessoa que respondeu, por telefone, à pesquisa anual de fatores de risco do CDC dos Estados Unidos (BRFSS 2015), anonimizada na origem — não há nome, data, endereço nem identificador individual, e o `ID` do arquivo é só a posição da linha. Por isso a interface descreve esta base como pública e anonimizada, e não como fictícia.

## Citação

Bloco copiado da página do conjunto no repositório público (a citação que ela mesma oferece), da página do conjunto de origem e da página da pesquisa no CDC. **É o único lugar do repositório onde o nome do autor do conjunto de origem pode aparecer**; o sub-bloco `autores-inicio`/`autores-fim` é o que `scripts/verificar-proveniencia.ps1` e `tests/test_proveniencia.py` leem para garantir que esse nome não foi copiado para nenhum outro arquivo.

<!-- citacao-inicio -->
CDC Diabetes Health Indicators [Dataset]. (2017). UCI Machine Learning Repository. https://doi.org/10.24432/C53919

Conjunto de origem, publicado no Kaggle por <!-- autores-inicio -->Alex Teboul<!-- autores-fim -->: "Diabetes Health Indicators Dataset", versão 1, 08/11/2021. https://www.kaggle.com/datasets/alexteboul/diabetes-health-indicators-dataset

Pesquisa de origem: Behavioral Risk Factor Surveillance System (BRFSS), 2015 — Centers for Disease Control and Prevention (CDC), Estados Unidos. https://www.cdc.gov/brfss/annual_data/annual_2015.html

Licença: CC0 1.0 Universal (domínio público), declarada no conjunto de origem; a página do repositório público remete a ela.
<!-- citacao-fim -->

## Ficha

| Campo | Valor |
|---|---|
| Nome do conjunto | CDC Diabetes Health Indicators |
| Instituição que publica | UCI Machine Learning Repository (University of California, Irvine) |
| Identificador no repositório | 891 — entrada do tipo *External* ("Linked on 9/25/2023", última atualização em 03/11/2023): o repositório só referencia o conjunto de origem e não lista criadores |
| URL | https://archive.ics.uci.edu/dataset/891/cdc+diabetes+health+indicators |
| DOI do conjunto | 10.24432/C53919 |
| Conjunto de origem | Kaggle, "Diabetes Health Indicators Dataset", identificador 1703281, versão 1 (08/11/2021), com três arquivos: três classes (253.680 linhas), binário (253.680) e binário balanceado 50/50 (70.692) |
| Licença | CC0 1.0, no conjunto de origem; a página do repositório diz "See linked dataset for licensing information" |
| Pesquisa de origem | BRFSS 2015 do CDC: 441.456 respostas × 330 colunas (página da pesquisa e codebook de 23/08/2016, `https://www.cdc.gov/brfss/annual_data/2015/pdf/codebook15_llcp.pdf`, sha256 `238bdeecb39c35e871384473cb24c02e3866e4f719da8fcf42154a35c051faca`) |
| Construção | notebook de limpeza do conjunto de origem (versão 5): 22 colunas do BRFSS, remoção de toda linha com valor ausente ou com "não sabe"/"recusou", recodificação para 0/1 — variável a variável em [`../../../docs/dicionario-de-dados-diabetes.md`](../../../docs/dicionario-de-dados-diabetes.md) |
| Tamanho | 253.680 respostas (57,5 % das 441.456); 21 variáveis e o alvo; no `data.csv` do repositório, mais a coluna `ID` (0 a 253.679, a posição da linha) |
| Pesos amostrais | ausentes: o BRFSS publica um peso por resposta, mas o conjunto não o carrega |
| Conferido em | 2026-10-18, na API do repositório público, na API do conjunto de origem, no código do notebook de limpeza e no codebook do BRFSS 2015 |

## O que a página do repositório diz e o arquivo desmente

Quatro afirmações da página não valem para este arquivo. Todas foram conferidas contra o próprio dado ou contra o código que o gerou.

**1. O alvo binário não inclui o pré-diabetes.** A página (e a descrição do conjunto de origem) diz `0 = no diabetes, 1 = prediabetes or diabetes`. O código de limpeza faz o contrário: troca o pré-diabetes por 0 e o diabetes por 1, com o comentário "0 meaning non-diabetic and pre-diabetic and 1 meaning diabetic". A conferência linha a linha contra o arquivo de três classes do conjunto de origem (`diabetes_012_health_indicators_BRFSS2015.csv`, 22.738.151 bytes, sha256 `a971809d0786d2d7d7f6070f83dfe8af9d860ea33a79e0e2701c8a49f78f9861`) — mesmas 21 variáveis, mesma ordem de linhas — dá:

| Classe no arquivo de três classes | `Diabetes_binary = 0` | `Diabetes_binary = 1` |
|---|---|---|
| 0 — sem diabetes, ou diabetes só na gravidez | 213.703 | 0 |
| 1 — pré-diabetes ou diabetes limítrofe | 4.631 | 0 |
| 2 — diabetes | 0 | 35.346 |

`Diabetes_binary = 1` é, portanto, quem respondeu "sim" a "(alguma vez um profissional de saúde disse que) você tem diabetes" (`DIABETE3 = 1` no codebook); diabetes só na gravidez e pré-diabetes viram 0. O `data.csv` do repositório é, linha a linha, o arquivo binário do conjunto de origem (`diabetes_binary_health_indicators_BRFSS2015.csv`, sha256 `19f367e3e3350768f0c144c5d73ee5b355f67a57eaaa86ca7bd8aec594d8b1d0`), com os valores em inteiros em vez de `1.0` e a coluna `ID` à frente. O arquivo de três classes não entra no repositório: serviu só a esta conferência.

**2. O ano é 2015, não 2014.** O "Dataset link" da página aponta o BRFSS 2014. O código de limpeza lê o arquivo de 2015 e cita o codebook de 2015, os arquivos do conjunto de origem se chamam `…_BRFSS2015.csv`, e o número de respostas de partida (441.456) é o da pesquisa de 2015.

**3. A descrição da página não é deste arquivo.** Ela fala em "35 features", em "lab test results" e em três "Class Labels". O arquivo tem 21 variáveis, todas de questionário ou calculadas a partir dele, e alvo binário. O "Introductory Paper" que a página lista (MMWR, 2017, sobre doença renal terminal atribuída ao diabetes) não descreve a construção deste conjunto.

**4. A licença está só no conjunto de origem.** A página do repositório não declara licença; remete ao conjunto de origem, que é CC0.

## O que foi alterado em relação ao original

Nada no conteúdo. O arquivo foi renomeado de `data.csv` para `cdc_diabetes_health_indicators.csv` (nome descritivo, convenção do repositório); os 253.680 registros, as 23 colunas, a ordem das linhas e os bytes — inclusive as quebras CRLF — são os do arquivo recebido. Toda transformação (nomes em português, `0`/`1` em `Não`/`Sim`, o sexo em `Feminino`/`Masculino`, o `ID` em `linha_origem`) acontece em código versionado — `backend/app/diabetes/dominio/features.py::preparar_base` e `backend/app/diabetes/dados/seed.py` — e está descrita no dicionário.

## Até onde estes números valem

- **Autodeclarado.** Diagnósticos, hábitos e até o IMC (calculado pelo CDC a partir do peso e da altura informados) são o que a pessoa respondeu ao telefone.
- **Transversal.** Uma resposta por pessoa, num momento só: associação, não causa. Quem já tem o diagnóstico pode ter mudado os hábitos depois dele (causalidade reversa), e "diabetes" aqui é diagnóstico recebido — quem tem e não sabe responde "não".
- **Sem pesos e só casos completos.** A prevalência na base (35.346 de 253.680, 13,93 %) não estima a prevalência da população dos Estados Unidos: o conjunto não traz os pesos amostrais, e a exclusão das respostas incompletas não foi aleatória — só a renda tem 76.204 respostas "não sabe" ou "recusou" no codebook. Menos ainda estima a do Brasil.
