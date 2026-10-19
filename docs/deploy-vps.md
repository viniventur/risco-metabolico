# Publicar na VPS

Passo a passo para colocar a **Triagem Metabólica** no ar na VPS do autor, com HTTPS e deploy
automático pelo GitHub Actions (ADR 0009). A VPS já está preparada: Ubuntu, usuário `deploy` no
grupo `docker`, SSH só com chave, firewall com 22/80/443, Docker com Compose e Caddy com um arquivo
por site em `/etc/caddy/sites/`.

Convenções: o domínio do app é **`triagem-metabolica.viniciusventura.com.br`**, e ele usa a porta
**`127.0.0.1:8085`** da VPS (a mesma VPS do Vamos à praia? e do Voluntários, que usam 8080 e
8083/8084); `SEU_IP` é o IP da VPS; comandos com `PS>` rodam no PowerShell do computador do autor, os
demais na VPS, logado como `deploy` (`ssh vps`).

## Como o deploy funciona

```
git push na main
   │
   ▼
GitHub Actions, workflow `ci` (todo push e pull request)
   ├─ proveniência: lista negra de termos, nomes, branch, caminho, nenhum .env
   ├─ backend: banco descartável, SQL, ruff, mypy, snapshot congelado, testes, verificar
   ├─ frontend: tipos gerados do contrato, lint, testes, build, JSON dos Estudos, bundle sem credencial
   └─ ambiente: as três imagens + pacote de deploy, stack inteira no ar, scripts/verificar-stack.sh
      │  só na main, e só se TUDO passou (e a variável VPS_HOST existir)
      ▼
GitHub Container Registry (privado): banco, api, web e pacote, cada um preso pelo digest
      │
      ▼
Deploy (ambiente "producao" do GitHub, com as senhas): SSH com uma chave que só roda o deploy.sh;
pelo stdin vão o .env, os digests e uma autorização de leitura do registro que vence com o job
      │
      ▼
VPS: ~/risco-metabolico/deploy.sh — confere cada variável, baixa as imagens, reaplica schema,
grants e o papel da API, semeia as duas bases (idempotente), carrega as referências de deriva das
duas vertentes, sobe tudo, confere /api/v1/health e /api/v1/ready pelo nginx; se falhar, volta
sozinho para a versão anterior
      │
      ▼
Aceite visto de fora (scripts/verificar-producao.sh): HTTPS, HSTS, health, ready, preflight CORS,
bundle sem credencial, portas internas fechadas
```

Na VPS ficam só `~/risco-metabolico` (o `deploy.sh`, os dois compose, o `.env` e `.anterior/`), as
imagens e o volume do banco. Não há código-fonte, histórico do Git nem chave que abra o repositório.

## Passo 1. Domínio

Onde o DNS de `viniciusventura.com.br` é administrado (a mesma zona dos outros subdomínios), crie:

| Tipo | Nome | Valor |
|---|---|---|
| A | `triagem-metabolica` | `SEU_IP` |
| AAAA | `triagem-metabolica` | o IPv6 da VPS (só se os outros subdomínios também tiverem) |

TTL baixo enquanto configura. Confira a propagação antes do Passo 5 (o Caddy só tira o certificado
com o nome já apontado):

```powershell
PS> Resolve-DnsName triagem-metabolica.viniciusventura.com.br
```

## Passo 2. A pasta do app na VPS (uma vez só)

```bash
install -d -m 700 ~/risco-metabolico
```

No computador, copie o script (o `vps` é o atalho do `~/.ssh/config`):

```powershell
PS> scp D:\trabalhos\ds\risco-metabolico\scripts\deploy.sh vps:risco-metabolico/deploy.sh
```

Não edite arquivos nessa pasta: cada deploy troca o compose, o `.env` e o próprio `deploy.sh` pelos
que vieram do GitHub. Confira que a porta **8085** está livre e acrescente a linha deste sistema à
tabela de portas do guia da VPS:

```bash
ss -ltn | grep 127.0.0.1          # 8085 NÃO pode aparecer (8080 é do Vamos à praia?, 8083/8084 do Voluntários)
```

| Sistema | Porta no servidor | Arquivo do Caddy | Pasta | Repositório |
|---|---|---|---|---|
| Triagem Metabólica | `127.0.0.1:8085` | `/etc/caddy/sites/triagem-metabolica.caddy` | `~/risco-metabolico` | `viniventur/risco-metabolico` (guia em `docs/deploy-vps.md`) |

## Passo 3. Chave do GitHub Actions, presa ao deploy.sh

O Actions entra na VPS com uma chave só dele, que o SSH prende ao `deploy.sh`: com ela não se abre
terminal nem túnel, só se dispara o deploy. Gere o par no computador e instale a pública na VPS:

```powershell
PS> ssh-keygen -t ed25519 -N '""' -C "github-actions-risco-metabolico" -f chave-actions
PS> Get-Content chave-actions.pub
```

Na VPS (uma linha só; o `>>` acrescenta, nunca use `>` neste arquivo):

```bash
echo 'command="bash /home/deploy/risco-metabolico/deploy.sh",restrict ssh-ed25519 AAAA...resto-da-chave-publica... github-actions-risco-metabolico' >> ~/.ssh/authorized_keys
```

A chave **privada** (`chave-actions`, inteira, do `-----BEGIN` ao `-----END`) vai para o secret
`VPS_SSH_KEY` do ambiente `producao` (Passo 4). Depois apague os dois arquivos do computador.

A identidade da VPS, para o Actions ter certeza de que fala com ela: a linha de `SEU_IP` do
`~/.ssh/known_hosts` do computador (ou `ssh-keyscan -t ed25519 SEU_IP`, conferido contra ela) vai
para o secret `VPS_KNOWN_HOSTS`.

## Passo 4. Senhas e configuração no GitHub

Três segredos hexadecimais diferentes (o `deploy.sh` recusa outro formato e senhas iguais):

```powershell
PS> 1..3 | ForEach-Object { [System.Security.Cryptography.RandomNumberGenerator]::GetHexString(48, $true) }
```

Ambiente `producao` (Settings → Environments), restrito à branch `main`, com os secrets:

| Secret | Valor |
|---|---|
| `POSTGRES_PASSWORD` | 1ª senha — o dono do banco (seed, retenção, congelar) |
| `API_DB_PASSWORD` | 2ª senha — o papel `triagem_api` da API |
| `SAL_TAXA` | 3ª senha — sal do HMAC da limitação de taxa (§6.8.2) |
| `VPS_SSH_KEY` | a chave privada do Passo 3 |
| `VPS_KNOWN_HOSTS` | a linha do `known_hosts` do Passo 3 |

Variáveis do repositório (Settings → Secrets and variables → Actions → Variables):

| Variable | Valor |
|---|---|
| `VPS_USER` | `deploy` |
| `WEB_HOST_PORT` | `8085` (o padrão do deploy; a variável só precisa existir se a porta mudar) |
| `RETENCAO_DIAS` | `90` |
| `TETO_LINHAS_LOG` | `500000` até a medição do Passo 8 |
| `VPS_HOST` | `SEU_IP` — **liga o deploy**; crie por último, depois do Passo 5 |
| `SITE_URL` | `https://triagem-metabolica.viniciusventura.com.br` (sem barra no fim) — **obrigatória para o deploy**: vira o `ORIGENS_CORS` da API e liga o aceite visto de fora (Passo 7) |

Pela linha de comando: `gh secret set NOME --env producao`, `gh variable set NOME --body VALOR`.

## Passo 5. HTTPS com o Caddy (antes do primeiro deploy)

Faça antes do primeiro deploy: o deploy exige a `SITE_URL`, e com ela o aceite visto de fora roda logo
depois e precisa do HTTPS no ar. Com o DNS do Passo 1 já propagado, o Caddy tira o certificado na hora;
até o deploy subir o app, o endereço responde 502, o que é esperado.

```bash
sudo tee /etc/caddy/sites/triagem-metabolica.caddy > /dev/null <<'EOF'
triagem-metabolica.viniciusventura.com.br {
    encode zstd gzip
    header {
        -Server
        -X-Powered-By
    }
    reverse_proxy 127.0.0.1:8085
}
EOF
grep -q '^import sites/' /etc/caddy/Caddyfile || echo "ATENÇÃO: falta 'import sites/*.caddy' no /etc/caddy/Caddyfile"
sudo caddy fmt --overwrite /etc/caddy/sites/triagem-metabolica.caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 20 --no-pager          # "certificate obtained successfully"
```

Não acrescente `log` a este arquivo: o produto não guarda IP em lugar nenhum (o nginx do app roda com
`access_log off`), e um log do Caddy seria o único registro de acesso — e a Política de Privacidade
diz que ele não existe.

O Caddy manda o IP de quem acessa no `X-Forwarded-For`; o nginx do app só confia nele vindo de rede
privada (o Caddy) e repassa o IP verdadeiro à API no `X-Real-IP`, que é o que a limitação de taxa
usa — sem isso, todos os visitantes dividiriam um limite só.

## Passo 6. Primeiro deploy

Com `VPS_HOST` criada: **Actions → ci → Run workflow** (branch `main`), ou um push na `main`. O
job `ambiente` publica as imagens e o `deploy` as põe no ar. Na VPS:

```bash
cd ~/risco-metabolico
ls -A                                                   # deploy.sh, docker-compose*.yml, .env, .anterior/, .deploy.lock
docker compose ps                                       # banco, api, web e retencao-log healthy; porta só no web
curl -s http://127.0.0.1:8085/api/v1/health    # {"status":"ok", ... "banco":"ok" ...}
curl -s http://127.0.0.1:8085/api/v1/ready     # {"pronto":true, ...}
```

## Passo 7. Aceite de F17

Com a `SITE_URL` do Passo 4, o job "Aceite visto de fora" roda sozinho depois de cada deploy:
`scripts/verificar-producao.sh` (também à mão: `bash scripts/verificar-producao.sh https://triagem-metabolica.viniciusventura.com.br SEU_IP`).
Ele cobre o aceite do plano: `/api/v1/health` com `banco` `ok` ou `frio` e nunca 5xx, o preflight
`OPTIONS /api/v1/predicoes` com `Access-Control-Allow-Origin` igual à origem do site, nenhuma
credencial no bundle servido, HTTPS e HSTS, portas 8000/8080/8085/5432/55432 fechadas.

Por fim, os logs do deploy no Actions **não podem conter a DSN nem senha**: o `deploy.sh` nunca
imprime valores, e o job não usa `set -x`.

## Passo 8. Medir `TETO_LINHAS_LOG` (§6.8.6)

Depois de algumas predições reais, na VPS:

```bash
cd ~/risco-metabolico
docker compose exec -T banco sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq' <<'SQL'
SELECT count(*), avg(pg_column_size(l.*))::int AS bytes_por_linha,
       pg_size_pretty(pg_total_relation_size('operacao.log_predicao')) AS tamanho_total
FROM operacao.log_predicao l;
SQL
df -h /
```

O teto é o espaço que se aceita dar ao log dividido pelos bytes por linha medidos; o valor e a data
vão para a tabela "Conferido na VPS" da ADR 0007 e para a variável `TETO_LINHAS_LOG`.

## Vertente diabetes

A triagem de diabetes é a segunda vertente do app (ADR 0013). No deploy ela não pede nenhum passo à
mão, nenhum secret e nenhuma variável nova no GitHub. O que muda dentro do mesmo fluxo:

- **A imagem da API** baixa no build também o `.pkl` e o snapshot do release `diabetes-v<versao>`,
  que é o `release` do manifest dela (`artifacts/diabetes/manifest.json`). Ela confere os dois
  `sha256` e deriva a base do painel da vertente (`python -m app.diabetes.treino.painel`). O
  release da obesidade continua sendo `v<versao>`.
- **O `deploy.sh`** semeia `dados.registros_diabetes` e carrega a referência de deriva dela, as
  tabelas `operacao.diabetes_*`, pela imagem da API e com o dono do banco. O seed é idempotente pelo
  `sha256` do CSV: depois da primeira carga, não escreve nada.
- **`N_MINIMO_DERIVA_DIABETES=300`** vem do `docker-compose.yml`, como a da obesidade. Ela é
  opcional: sem ela, a API sobe e só a deriva da vertente responde `disponivel: false` (ADR 0014).
- **`/api/v1/ready`** só responde 200 com o artefato e a base do painel das duas vertentes. Um
  artefato da vertente que não carregue reprova a conferência do deploy, e o `deploy.sh` volta
  sozinho para a versão anterior.

**O primeiro deploy com a vertente cai por cima do volume da v2.**

- O `schema.sql` reaplicado cria as tabelas novas (`CREATE TABLE IF NOT EXISTS`) e troca a view e a
  função de consolidação do log (`CREATE OR REPLACE`, com as mesmas colunas e a mesma assinatura).
- O seed carrega a base da vertente uma vez.
- Nada do que a v2 gravou é apagado ou alterado: o log, a base da obesidade e a série de deriva
  ficam como estão.

Para conferir na VPS:

```bash
cd ~/risco-metabolico
curl -s http://127.0.0.1:8085/api/v1/ready                          # {"pronto":true, ...}: as duas vertentes
curl -s http://127.0.0.1:8085/api/v1/diabetes/model/info | head -c 200    # versão e release do modelo de diabetes
docker compose exec -T banco sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -c "SELECT count(*) FROM dados.registros_diabetes"'
```

O `count(*)` tem de bater com as linhas do `FONTE.md` da vertente.

**Voltar uma versão.** A volta, automática ou por `git revert`, reaplica o `schema.sql` anterior:

- as tabelas da vertente ficam, sem uso;
- a view e a função de consolidação voltam à definição antiga;
- na volta automática, quem roda é o `deploy.sh` novo, com a imagem anterior da API. Ele vê que
  ela não tem a vertente e pula o seed e a referência de deriva dela ("A imagem da API é anterior
  à vertente diabetes" no log do deploy).

A única ressalva é uma volta longa. Se a versão sem a vertente ficar no ar mais que `RETENCAO_DIAS`
com linhas de diabetes no log, a consolidação antiga as poria nas faixas NULL da obesidade (ADR 0014,
decisão 3).

**Retreino da vertente.** O processo é o mesmo da obesidade:

1. `python -m app.diabetes.treino treinar --versao X.Y.Z` local;
2. o release `diabetes-vX.Y.Z` com o `.pkl` e o snapshot, criado com `--latest=false` para o release
   da obesidade seguir como o mais recente;
3. o commit do manifest dela.

O push publica a imagem nova, que baixa os dois assets no build. O passo a passo completo está na
seção 18 do README.

## No dia a dia

- **Publicar:** push na `main`. O CI testa, publica, o deploy sobe e o aceite confere.
- **Voltar uma versão:** `git revert` e push (o CI testa a volta), ou **Re-run all jobs** na execução
  boa. Se um deploy falhar no meio, o `deploy.sh` já volta sozinho.
- **Trocar senha:** novo secret no ambiente `producao` e **Run workflow**; o deploy aplica no banco e
  na API. `VPS_SSH_KEY`: apague a linha `github-actions-risco-metabolico` do `authorized_keys` e
  refaça o Passo 3.
- **Deploy à mão (sem o GitHub):** `cd ~/risco-metabolico && bash deploy.sh "$(sed -n 's/^VERSAO=//p' .env)" < .env`
  repete a versão no ar com as imagens que já estão lá.
- **Retreino:** `python -m app.treino treinar --versao X.Y.Z` local, release `vX.Y.Z` com o `.pkl` e o
  snapshot, commit do manifest; o push publica a imagem nova, que baixa os dois assets no build.
- **Comandos úteis:** `docker compose ps`, `docker compose logs -f --tail=100 api`,
  `docker compose logs retencao-log`, `docker compose restart api`, `df -h`, `docker system df`.
  Na VPS nunca rode `docker system prune` nem `docker volume prune`: há outros sistemas.

## Checklist de lançamento

- [ ] Verificação em duas etapas na conta do GitHub (quem entra na conta publica no servidor)
- [ ] Ambiente `producao` só para a `main`, com `POSTGRES_PASSWORD`, `API_DB_PASSWORD`, `SAL_TAXA`,
      `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS`; as três senhas também no gerenciador de senhas
- [ ] Registro `A` de `triagem-metabolica` apontando para a VPS (`Resolve-DnsName` responde `SEU_IP`)
- [ ] Porta `127.0.0.1:8085` livre na VPS e a linha deste sistema na tabela de portas do guia da VPS
- [ ] `deploy.sh` em `~/risco-metabolico` e a chave do Actions presa a ele no `authorized_keys`
- [ ] Variáveis `VPS_USER` e `RETENCAO_DIAS` (já existem) e `SITE_URL`
- [ ] `/etc/caddy/sites/triagem-metabolica.caddy` sem `log`, `caddy validate` limpo, certificado emitido
- [ ] Por último, `VPS_HOST`: primeiro deploy verde, `docker compose ps` com tudo `healthy`,
      `/api/v1/health` com `banco` `ok` e o "Aceite visto de fora" verde
- [ ] No navegador: o Início, a Visão Geral, um cálculo no simulador e o relatório; a prévia do link
      (LinkedIn Post Inspector ou opengraph.xyz) com a imagem `og-imagem.png`
- [ ] Snapshot da VPS no hPanel com tudo funcionando
