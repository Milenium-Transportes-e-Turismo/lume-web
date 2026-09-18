# Configuração de ambiente

O Tenant Web valida configuração com Zod antes de entregar cada valor aos
adapters. A separação é intencional:

- `src/env.ts` contém o schema privado, tipos, defaults e funções de parsing
  server-only;
- `src/env.server.ts` lê as variáveis privadas somente no processo Next.js e
  faz o parsing de forma lazy, no momento do uso;
- `src/env.public.ts` contém o schema público e referencia explicitamente apenas
  `NEXT_PUBLIC_*`, que o Next.js pode incluir no bundle do navegador.

O parsing server-side não ocorre ao importar um módulo. Isso permite gerar a
imagem `standalone` sem `SESSION_SECRET` ou URL de produção e injetar esses
valores quando o contêiner inicia. Configuração inválida falha no consumidor e
faz `/api/readiness` responder `503`, sem imprimir o valor ou o segredo.

## Variáveis aceitas

| Variável                                     | Visibilidade    | Regra                                                                                |
| -------------------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `LUME_TENANT_API_URL`                        | privada         | obrigatória em runtime; URL HTTP local e HTTPS em produção                           |
| `LUME_TENANT_API_TIMEOUT_MS`                 | privada         | opcional; inteiro entre 100 e 30000; padrão 5000                                     |
| `LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS` | privada         | opcional; inteiro a partir de 30000; padrão 300000                                   |
| `LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS` | privada         | opcional; inteiro a partir de 30000; padrão 600000                                   |
| `SESSION_SECRET`                             | secreta         | obrigatória em runtime; pelo menos 32 bytes                                          |
| `AUTH_SIMULATION_ENABLED`                    | privada         | `true` ou `false`; produção aceita somente `false`                                   |
| `LUME_TENANT_WHATSAPP_DATA_SOURCE`           | privada         | `api` ou `mock`; produção aceita somente `api`                                       |
| `MAP_STYLE_URL`                              | pública por uso | legado: URL validada; não controla o mapa Leaflet atual e não pode conter credencial |
| `NEXT_PUBLIC_TENANT_NAME`                    | pública         | contexto textual; padrão `Empresa`                                                   |
| `NEXT_PUBLIC_TENANT_PRODUCT_NAME`            | pública         | contexto textual; padrão `Lume`                                                      |

Ausência de `LUME_TENANT_API_URL` e `SESSION_SECRET` é tolerada durante a
compilação porque nenhuma rota deve acessar serviços ou criar cookies no build.
Os dois valores continuam obrigatórios para o runtime saudável e são verificados
pelos respectivos adapters e pela readiness.

## Desenvolvimento com `.env`

Copie `.env.example` para `.env.local`. Os nomes e valores existentes continuam
compatíveis; não é preciso trocar o formato do arquivo. O Next.js carrega o
arquivo no processo local e `src/env.server.ts` o valida quando a aplicação usa
a configuração. Nunca versione `.env.local`, `.env.production`, cookies ou
tokens.

Variáveis `NEXT_PUBLIC_*` são substituídas durante `next build`. Alterá-las
somente ao iniciar um contêiner já compilado não muda o JavaScript do navegador.
Quando identidade textual precisar variar entre réplicas da mesma imagem, ela
deve ser entregue por configuração server-side explícita, não por segredo nem
por acesso dinâmico a `process.env` no cliente.

## Contêiner e injeção em memória

Construa uma imagem imutável sem segredos:

```powershell
docker build --pull --tag lume-tenant-web:<sha> .
docker run --rm --env-file .env.production -p 3000:3000 lume-tenant-web:<sha>
```

Em produção, prefira o cofre/orquestrador da plataforma para materializar as
variáveis no ambiente do processo no início do contêiner. Não use `ARG`, `ENV`
ou `COPY` para gravar `SESSION_SECRET`, tokens ou credenciais em uma camada da
imagem. Os valores permanecem somente na memória do processo e não devem ser
registrados em logs, telemetria, páginas de erro ou respostas de sonda.

A troca de `SESSION_SECRET` invalida cookies existentes e exige novo login. Faça
a rotação de forma coordenada. Credenciais individuais de agentes OpenAI não
pertencem ao Tenant Web nem a `NEXT_PUBLIC_*`: devem ficar no cofre/backend e a
interface pode receber apenas estado seguro da credencial, nunca a chave.

O planejador usa Leaflet/OpenStreetMap. `MAP_STYLE_URL` permanece como
configuração de compatibilidade e não seleciona o estilo do mapa atual.

## Demonstração local sem login

`AUTH_LOCAL_AUTO_LOGIN=true` permite abrir `/` ou `/login` e entrar diretamente
no Dashboard com o perfil **Demonstração local**, sem cookies ou credenciais.
Exige `NODE_ENV=development`, `AUTH_SIMULATION_ENABLED=true` e
`LUME_TENANT_WHATSAPP_DATA_SOURCE=mock`. A configuração é recusada em produção.
O acesso reúne os departamentos dos usuários simulados; não fornece tokens da
API nem simula persistência. Módulos que dependem da API continuam indisponíveis.
Para retornar ao login, defina `AUTH_LOCAL_AUTO_LOGIN=false` no `.env.local`.
