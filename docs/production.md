# Produção

O Tenant Web é um frontend server-side do tenant. Ele acessa somente a
`LUME_TENANT_API_URL`; navegador, Route Handlers e Server Actions nunca chamam
automações externas, Evolution, Control ou Edge diretamente.

## Artefato

O `Dockerfile` gera o `output: standalone` do Next.js em uma imagem sem
dependências de desenvolvimento e executa o processo como o usuário não-root
`nextjs`.

O build não recebe segredos. `src/env.server.ts` lê e valida as variáveis de
forma lazy depois que o processo inicia, permitindo injeção pelo cofre ou pelo
ambiente do contêiner sem gravá-las nas camadas da imagem. Consulte
[environment-configuration.md](environment-configuration.md) para o contrato
completo e os limites dos timeouts.

A compilação usa uma pilha tipográfica local do sistema e não baixa fontes
externas. Isso mantém o artefato reproduzível mesmo quando o ambiente de build
não possui acesso ao Google Fonts.

```powershell
docker build --pull --tag lume-tenant-web:<sha> .
docker run --rm --env-file .env.production -p 3000:3000 lume-tenant-web:<sha>
```

Use uma tag imutável baseada no SHA auditado. Não use `latest` como referência
de rollback.

## Configuração obrigatória

Copie `.env.production.example` para o cofre de configuração da plataforma, não
para a imagem. Requisitos:

- `LUME_TENANT_API_URL` deve ser HTTPS e terminar no prefixo da API, normalmente
  `/api/v1`;
- `SESSION_SECRET` deve ser aleatório, ter pelo menos 32 caracteres e ser
  diferente entre instalações;
- `AUTH_SIMULATION_ENABLED=false`;
- `LUME_TENANT_WHATSAPP_DATA_SOURCE=api`;
- `LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS` compatível com o maior backup
  aceito pela API; o exemplo usa dez minutos.
- `MAP_STYLE_URL` pode apontar para um estilo MapLibre HTTPS; o padrão público é
  `https://tiles.openfreemap.org/styles/liberty` e não contém segredo.

Nunca grave tokens, cookies, `SESSION_SECRET` ou o arquivo real de ambiente em
logs, argumentos de build, imagens ou repositórios. Credenciais individuais de
agentes OpenAI ficam no backend/cofre; o Tenant Web nunca recebe a chave.

`NEXT_PUBLIC_*` é incorporada ao bundle no build. Não use esse prefixo para um
valor secreto nem espere que a variável mude ao iniciar outra réplica da mesma
imagem.

## Rede e TLS

Publique a porta 3000 somente na rede interna do proxy reverso. O proxy deve:

- terminar TLS;
- preservar `Host` e `X-Forwarded-Proto`;
- recusar HTTP externo ou redirecioná-lo para HTTPS;
- limitar o tamanho de corpo;
- aplicar timeout superior ao timeout server-side da Tenant API.

Para propostas, o limite de corpo do proxy deve aceitar multipart de pelo menos
50 MiB mais os campos do formulário: o lote permite até cinco PDFs e cada um
mantém o limite individual de 10 MiB. O limite público não deve ser removido: a
Tenant API continua sendo a autoridade da validação de tamanho, MIME, assinatura
PDF e hash. O Next.js aceita até 51 MiB na Server Action para comportar o lote e
o overhead do multipart; o proxy não pode impor um limite inferior. O adapter
reserva trinta segundos para cada upload multipart. Configure timeouts do proxy
acima da janela do lote para não transformar um upload persistido em erro
ambíguo no navegador.

O processo server-side do Tenant Web precisa alcançar apenas a Tenant API e os
destinos HTTPS dos anexos publicados por ela. O navegador também acessa o host
do estilo e os hosts de tiles, sprites e fontes referenciados por esse estilo;
uma CSP futura deve permiti-los explicitamente em `connect-src` e `img-src`.

Para a importação assistida, o proxy deve aceitar até 2 GiB mais o overhead
multipart e manter streaming habilitado. Esse limite contempla tanto um ZIP
quanto um `msgstore.db.crypt15`; a Tenant API continua impondo o limite real por
arquivo. Em Nginx, configure o equivalente a `client_max_body_size 2g` e
timeouts compatíveis com a conexão do operador. A aplicação envia somente um
arquivo por requisição; não acumule todo o lote no proxy. O volume privado dos
lotes pertence à Tenant API e não deve ser montado no frontend.

## Sondas

- `GET /api/health`: liveness do processo Next.js;
- `GET /api/readiness`: valida a configuração e a sonda
  `GET <LUME_TENANT_API_URL>/health/ready`.

Use `health` para reinício do contêiner e `readiness` para entrada/remoção no
balanceador. Nenhuma sonda expõe segredos ou JWTs.

## Publicação

1. Execute `npm ci`, typecheck, lint, testes e build.
2. Gere e identifique a imagem pelo SHA.
3. Confirme que as migrations e o bootstrap da Tenant API já terminaram.
4. Suba uma réplica sem tráfego e valide `health` e `readiness`.
5. Confirme que a senha inicial não cria sessão, solicite recuperação por
   **Esqueci minha senha**, abra o link de e-mail em `/reset-password` e entre
   somente com a nova senha. Repita com um identificador inexistente e confirme
   que a resposta visual é a mesma.
6. Valide um usuário `active`, outro `inactive` e uma suspensão temporária com
   motivo; confirme bloqueio de login/sessão e posterior ativação.
7. Execute abertura de conversa, takeover, envio controlado pelo atendente em
   **Abrir chat** e um canário de orçamento criado pelo workspace com PDF não
   sensível. Confirme também a grafia do nome do PDF com caracteres acentuados.
8. Valide o encerramento de uma conversa sem proposta ativa, confirme no
   histórico de ações data, atendente e motivo e verifique a mensagem automática
   de despedida no WhatsApp. Repita com uma proposta já aprovada e confirme que
   o MVP permite o comando. Confirme também que uma proposta ainda em andamento
   bloqueia o encerramento e que qualquer recusa da Tenant API é exibida sem
   simular sucesso.
9. Verifique o sino em usuários de departamentos diferentes e confirme que cada
   um recebe somente notificações do próprio escopo. No Comercial, valide o
   aviso de novo orçamento pendente.
10. Confirme os grupos **Geral**, **Comercial** e **Administração** na sidebar,
    o envio de suporte pelo provedor e, ao simular uma falha autorizada, o
    `mailto:` com identificação do solicitante; confirme também a negativa de
    `/users` e `/license` fora de Gerência ou sem suas permissões individuais.
11. Com um usuário autorizado, confirme **Roteirização** sob **Operacional** e
    execute um cálculo controlado. A requisição deve ir somente para a Tenant
    API e uma base de pedágios indisponível deve aparecer como cobertura parcial,
    sem valores simulados. O mapa deve enquadrar a rota, mostrar origem, destino,
    paradas e pedágios e preservar a atribuição OpenStreetMap/OpenMapTiles.
12. Direcione tráfego e acompanhe erros 401, 403, 409, 423, 5xx e falhas de
    readiness.

O envio pelo atendente registra primeiro uma mensagem `pending` na Tenant API. A
confirmação `sent`, `delivered`, `read` ou `failed` aparece depois pelo polling;
uma resposta HTTP bem-sucedida do painel não deve ser interpretada como entrega
ao WhatsApp.

## Rollback

Mantenha a imagem anterior e o conjunto de variáveis compatível. Para rollback,
retire a imagem nova do balanceador, restaure a imagem anterior e valide as duas
sondas. O frontend não executa migrations e seu rollback não deve reverter o
banco da Tenant API.
