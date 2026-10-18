# Publicar na VPS

Passo a passo para colocar a **Triagem Metabólica** no ar na VPS do autor, com HTTPS e deploy
automático pelo GitHub Actions (ADR 0009). A VPS já está preparada: Ubuntu, usuário `deploy` no
grupo `docker`, SSH só com chave, firewall com 22/80/443, Docker com Compose e Caddy com um arquivo
por site em `/etc/caddy/sites/`.

Convenções: `DOMINIO` é o domínio deste app; `SEU_IP` é o IP da VPS; comandos com `PS>` rodam no
PowerShell do computador do autor, os demais na VPS, logado como `deploy` (`ssh vps`).

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
grants e o papel da API, semeia (idempotente), carrega a referência de deriva, sobe tudo, confere
/api/v1/health e /api/v1/ready pelo nginx; se falhar, volta sozinho para a versão anterior
      │
      ▼
Aceite visto de fora (scripts/verificar-producao.sh): HTTPS, HSTS, health, ready, preflight CORS,
bundle sem credencial, portas internas fechadas
```

Na VPS ficam só `~/risco-metabolico` (o `deploy.sh`, os dois compose, o `.env` e `.anterior/`), as
imagens e o volume do banco. Não há código-fonte, histórico do Git nem chave que abra o repositório.

## Passo 1. Domínio

Onde o DNS do domínio é administrado, crie um registro `A` para `DOMINIO` apontando para `SEU_IP`
(TTL baixo enquanto configura). Confira a propagação antes do Passo 6:

```powershell
PS> Resolve-DnsName DOMINIO
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
que vieram do GitHub. Confira também qual porta `127.0.0.1:WEB_HOST_PORT` está livre para este app
(a lista de portas dos outros sistemas fica no guia da VPS):

```bash
ss -ltn | grep 127.0.0.1
```

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
| `WEB_HOST_PORT` | a porta livre do Passo 2 (padrão `8083`) |
| `RETENCAO_DIAS` | `90` |
| `TETO_LINHAS_LOG` | `500000` até a medição do Passo 8 |
| `VPS_HOST` | `SEU_IP` — **liga o deploy**; crie por último |
| `SITE_URL` | `https://DOMINIO` — liga o aceite visto de fora (Passo 7) |

Pela linha de comando: `gh secret set NOME --env producao`, `gh variable set NOME --body VALOR`.

## Passo 5. Primeiro deploy

Com `VPS_HOST` criada: **Actions → ci → Run workflow** (branch `main`), ou um push na `main`. O
job `ambiente` publica as imagens e o `deploy` as põe no ar. Na VPS:

```bash
cd ~/risco-metabolico
ls -A                                                   # deploy.sh, docker-compose*.yml, .env, .anterior/, .deploy.lock
docker compose ps                                       # banco, api, web e retencao-log healthy; porta só no web
curl -s http://127.0.0.1:WEB_HOST_PORT/api/v1/health    # {"status":"ok", ... "banco":"ok" ...}
curl -s http://127.0.0.1:WEB_HOST_PORT/api/v1/ready     # {"pronto":true, ...}
```

## Passo 6. HTTPS com o Caddy

```bash
sudo tee /etc/caddy/sites/risco-metabolico.caddy > /dev/null <<'EOF'
DOMINIO {
    encode zstd gzip
    header {
        -Server
        -X-Powered-By
    }
    reverse_proxy 127.0.0.1:WEB_HOST_PORT
}
EOF
sudo caddy fmt --overwrite /etc/caddy/sites/risco-metabolico.caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 20 --no-pager          # "certificate obtained successfully"
```

Não acrescente `log` a este arquivo: o produto não guarda IP em lugar nenhum (o nginx do app roda com
`access_log off`), e um log do Caddy seria o único registro de acesso.

## Passo 7. Aceite de F17

Crie a variável `SITE_URL` e rode **Actions → ci → Run workflow**: o job "Aceite visto de fora" roda
`scripts/verificar-producao.sh` (também à mão: `bash scripts/verificar-producao.sh https://DOMINIO SEU_IP`).
Ele cobre o aceite do plano: `/api/v1/health` com `banco` `ok` ou `frio` e nunca 5xx, o preflight
`OPTIONS /api/v1/predicoes` com `Access-Control-Allow-Origin` igual à origem do site, nenhuma
credencial no bundle servido, HTTPS e HSTS, portas 8000/8080/8083/5432/55432 fechadas.

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
