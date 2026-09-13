# Ambientes e branches do Tenant Web

## Estado verificado em 11/08/2026

O repositório documenta a construção da imagem Docker, mas não contém workflow
de deploy automático nem arquivo Compose versionado. Portanto, o deploy atual é
manual ou depende de configuração externa na VPS que deve ser auditada no
servidor. A branch `develop` concentra desenvolvimento e homologação; a `main`
permanece reservada para produção.

## Regra obrigatória

- staging recebe somente a branch `develop`;
- produção recebe somente a branch `main`;
- cada ambiente usa clone, imagem, porta, domínio, `SESSION_SECRET` e arquivo de
  variáveis próprios;
- a URL da Tenant API de staging nunca pode apontar para a API de produção;
- produção só é atualizada após aprovação explícita do staging.

## Staging

### Pré-requisitos de publicação

Uma atualização da VPS só pode começar depois que:

1. as mudanças revisadas do Tenant API e do Tenant Web estiverem commitadas e
   integradas em `origin/develop`;
2. os dois SHAs esperados estiverem registrados;
3. o repositório de staging da VPS estiver sem alterações locais;
4. o backup recuperável da API, do banco e das mídias tiver sido concluído;
5. `.env.staging` usar somente endpoints, credenciais, banco e volumes de
   staging.

Não faça deploy direto de uma branch de trabalho. A
Tenant API deve ser atualizada e ficar saudável antes do Tenant Web, porque ela
é a fonte autoritativa dos contratos, migrations, permissões e estados.

### Atualização da Tenant API

No clone `/home/taiane/lume/lume-staging/lume-tenant-api`, siga o runbook do próprio
repositório em `docs/deployment-environments.md`: confirme backup, branch e SHA;
execute o Compose com `.env.staging`, `compose.prod.yml` e o `compose.vps.yml`
local; aguarde `migrate` terminar; então valide
`/api/v1/health/ready`. Se uma migration ou o bootstrap falhar, não prossiga
com o Web.

### Atualização segura do Tenant Web

O exemplo abaixo usa o clone, porta e nome já documentados para staging. Ajuste
somente se a descoberta na VPS comprovar valores diferentes. Execute todos os
blocos na mesma sessão Bash; `set -Eeuo pipefail` faz a sessão parar no primeiro
comando inválido. Se a conexão SSH cair, retorne ao diretório e repita a etapa
de descoberta antes de continuar.

```bash
set -Eeuo pipefail
cd /home/taiane/lume/lume-staging/lume-tenant-web
test -z "$(git status --porcelain)"
sudo nginx -t
sudo docker ps --all --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

git fetch --prune origin
git switch develop
git merge --ff-only origin/develop
test "$(git branch --show-current)" = "develop"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/develop)"
web_sha=$(git rev-parse --short=12 HEAD)
printf 'Tenant Web staging SHA: %s\n' "$web_sha"
```

Crie `.env.staging` uma única vez a partir de `.env.staging.example`, mantenha o
arquivo fora do Git e preserve o `SESSION_SECRET` atual entre deploys. Valide as
chaves sem imprimir valores secretos:

```bash
if ! test -f .env.staging; then
  install -m 600 .env.staging.example .env.staging
  generated_secret=$(openssl rand -hex 32)
  sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${generated_secret}/" .env.staging
  unset generated_secret
fi
chmod 600 .env.staging
test -f .env.staging
test "$(stat -c '%a' .env.staging)" = "600"
grep -q '^LUME_TENANT_API_URL=https://staging\.lumestack\.app\.br/api/v1$' .env.staging
grep -q '^AUTH_SIMULATION_ENABLED=false$' .env.staging
grep -q '^LUME_TENANT_WHATSAPP_DATA_SOURCE=api$' .env.staging
session_secret=$(sed -n 's/^SESSION_SECRET=//p' .env.staging | tail -n1)
test "$session_secret" != 'replace-me'
test "$session_secret" != 'replace-with-at-least-32-random-characters'
test "$(printf '%s' "$session_secret" | wc -c)" -ge 32
unset session_secret
```

Os valores `NEXT_PUBLIC_*` são públicos e entram no bundle durante o build. Leia
somente essas duas chaves e construa uma imagem imutável:

```bash
web_sha=$(git rev-parse --short=12 HEAD)
tenant_name=$(sed -n 's/^NEXT_PUBLIC_TENANT_NAME=//p' .env.staging | tail -n1)
product_name=$(sed -n 's/^NEXT_PUBLIC_TENANT_PRODUCT_NAME=//p' .env.staging | tail -n1)
test -n "$tenant_name"
test -n "$product_name"

sudo docker build --pull \
  --build-arg "NEXT_PUBLIC_TENANT_NAME=$tenant_name" \
  --build-arg "NEXT_PUBLIC_TENANT_PRODUCT_NAME=$product_name" \
  --tag "lume-tenant-web-staging:${web_sha}" .
```

Antes de tocar no contêiner que atende a porta 3100, execute a imagem na porta
auxiliar 3101. Reutilize a rede do contêiner atual quando ela não for a rede
padrão:

```bash
web_container=lume-tenant-web-staging
web_sha=$(git rev-parse --short=12 HEAD)
smoke_container="${web_container}-smoke-${web_sha}-$(date -u +%H%M%S)"
sudo docker inspect "$web_container" >/dev/null
if sudo ss -H -ltn 'sport = :3101' | grep -q .; then
  printf 'A porta de smoke 3101 já está em uso.\n' >&2
  exit 1
fi
current_network=$(sudo docker inspect --format '{{.HostConfig.NetworkMode}}' "$web_container" 2>/dev/null || true)
network_args=()
if test -n "$current_network" && test "$current_network" != default; then
  network_args=(--network "$current_network")
fi

sudo docker run --detach \
  --name "$smoke_container" \
  --env-file .env.staging \
  --publish 127.0.0.1:3101:3000 \
  "${network_args[@]}" \
  "lume-tenant-web-staging:${web_sha}"

for attempt in $(seq 1 60); do
  smoke_status=$(sudo docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$smoke_container" 2>/dev/null || true)
  test "$smoke_status" = healthy && break
  test "$smoke_status" = unhealthy && break
  sleep 3
done
if test "$smoke_status" != healthy \
  || ! curl --fail --show-error --max-time 15 http://127.0.0.1:3101/api/health \
  || ! curl --fail --show-error --max-time 15 http://127.0.0.1:3101/api/readiness; then
  sudo docker logs --tail 150 "$smoke_container" || true
  sudo docker stop "$smoke_container" 2>/dev/null || true
  exit 1
fi
sudo docker stop "$smoke_container"
sudo docker rm "$smoke_container"
```

Se o smoke falhar, o bloco imprime os logs e preserva o contêiner atual. Com o
smoke aprovado, mantenha o contêiner anterior como rollback, promova a nova
imagem e valide-a no mesmo bloco:

Faça a promoção dentro de uma sessão persistente, por exemplo
`tmux new -s lume-web-staging-deploy`, para que uma queda do SSH não interrompa
a restauração automática.

```bash
web_container=lume-tenant-web-staging
web_sha=$(git rev-parse --short=12 HEAD)
current_network=$(sudo docker inspect --format '{{.HostConfig.NetworkMode}}' "$web_container")
network_args=()
if test -n "$current_network" && test "$current_network" != default; then
  network_args=(--network "$current_network")
fi
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
rollback_container="${web_container}-rollback-${timestamp}"
sudo docker stop --timeout 30 "$web_container"
if ! sudo docker rename "$web_container" "$rollback_container"; then
  sudo docker start "$web_container"
  exit 1
fi

if ! sudo docker run --detach \
    --name "$web_container" \
    --restart unless-stopped \
    --env-file .env.staging \
    --publish 127.0.0.1:3100:3000 \
    "${network_args[@]}" \
    "lume-tenant-web-staging:${web_sha}"; then
  sudo docker rm --force "$web_container" 2>/dev/null || true
  sudo docker rename "$rollback_container" "$web_container"
  sudo docker start "$web_container"
  exit 1
fi

for attempt in $(seq 1 60); do
  deploy_status=$(sudo docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_container" 2>/dev/null || true)
  test "$deploy_status" = healthy && break
  test "$deploy_status" = unhealthy && break
  sleep 3
done

deployment_failed=0
test "$deploy_status" = healthy || deployment_failed=1
curl --fail --show-error --max-time 15 http://127.0.0.1:3100/api/health || deployment_failed=1
curl --fail --show-error --max-time 15 http://127.0.0.1:3100/api/readiness || deployment_failed=1
curl --fail --show-error --max-time 15 https://staging.lumestack.app.br/api/health || deployment_failed=1
curl --fail --show-error --max-time 15 https://staging.lumestack.app.br/api/readiness || deployment_failed=1
curl --fail --show-error --max-time 15 https://staging.lumestack.app.br/api/v1/health/ready || deployment_failed=1
test "$(curl --silent --max-time 15 --output /dev/null --write-out '%{http_code}' https://staging.lumestack.app.br/api/whatsapp-conversations)" = "401" || deployment_failed=1

if test "$deployment_failed" -ne 0; then
  sudo docker logs --tail 150 "$web_container" || true
  sudo docker rm --force "$web_container" 2>/dev/null || true
  sudo docker rename "$rollback_container" "$web_container"
  sudo docker start "$web_container"
  curl --fail --show-error --max-time 15 http://127.0.0.1:3100/api/readiness
  exit 1
fi

sudo docker inspect --format '{{.Config.Image}} {{.State.Health.Status}}' "$web_container"
sudo docker logs --tail 150 "$web_container"
printf 'Rollback preservado em: %s\n' "$rollback_container"
```

Se a conexão cair durante a promoção, reconecte à sessão `tmux`. Se ela não
existir mais, inspecione os contêineres antes de executar qualquer novo deploy:

```bash
set -Eeuo pipefail
cd /home/taiane/lume/lume-staging/lume-tenant-web
web_container=lume-tenant-web-staging
sudo docker ps --all --filter "name=${web_container}" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
recovery_status='missing'
for attempt in $(seq 1 60); do
  recovery_status=$(sudo docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_container" 2>/dev/null || true)
  test "$recovery_status" = healthy && break
  test "$recovery_status" = unhealthy && break
  sleep 3
done
if test "$recovery_status" != healthy; then
  rollback_container=$(sudo docker ps --all --filter "name=${web_container}-rollback-" --format '{{.Names}}' | sort | tail -n1)
  test -n "$rollback_container"
  sudo docker rm --force "$web_container" 2>/dev/null || true
  sudo docker rename "$rollback_container" "$web_container"
  sudo docker start "$web_container"
fi
curl --fail --show-error --max-time 15 http://127.0.0.1:3100/api/readiness
```

Não execute `docker system prune`, não remova volumes e não apague o contêiner de
rollback antes do canário autenticado. Depois das sondas, valide login,
recuperação de senha, administração de usuários e o fluxo de WhatsApp descrito
em `production.md`.

## Produção

Somente após aprovação e merge autorizado de `develop` em `main`:

```bash
cd /home/taiane/lume/lume-tenant-web
git fetch origin
git switch main
git pull --ff-only origin main
test "$(git branch --show-current)" = "main"
git_sha=$(git rev-parse --short=12 HEAD)
tenant_name=$(sed -n 's/^NEXT_PUBLIC_TENANT_NAME=//p' .env.production | tail -n1)
product_name=$(sed -n 's/^NEXT_PUBLIC_TENANT_PRODUCT_NAME=//p' .env.production | tail -n1)
docker build --pull \
  --build-arg "NEXT_PUBLIC_TENANT_NAME=$tenant_name" \
  --build-arg "NEXT_PUBLIC_TENANT_PRODUCT_NAME=$product_name" \
  --tag "lume-tenant-web:${git_sha}" .
docker run -d --restart unless-stopped \
  --name lume-tenant-web \
  --env-file .env.production \
  -p 127.0.0.1:3000:3000 \
  "lume-tenant-web:${git_sha}"
```

Os comandos de substituição e rollback do contêiner devem seguir a configuração
real do proxy e do orquestrador da VPS; não remova o contêiner anterior antes de
confirmar que a nova imagem está saudável.
