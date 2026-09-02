# Produção

O Tenant Web é um frontend server-side do tenant. Ele acessa somente a
`LUME_TENANT_API_URL`; navegador, Route Handlers e Server Actions nunca chamam
automações externas, Evolution, Control ou Edge diretamente.

## Artefato

O `Dockerfile` gera o `output: standalone` do Next.js em uma imagem sem
dependências de desenvolvimento e executa o processo como o usuário não-root
`nextjs`.

A compilação usa `next/font` para baixar Geist durante o build e incorporá-la ao
artefato final. O contêiner em runtime não busca fontes externas, mas o builder
precisa de saída HTTPS durante `npm run build`; uma falha nessa etapa deve
interromper o deploy antes do smoke test.

```powershell
$tenantName = "Empresa" # Ajuste para o nome público aprovado.
$productName = "Lume"
docker build --pull `
  --build-arg "NEXT_PUBLIC_TENANT_NAME=$tenantName" `
  --build-arg "NEXT_PUBLIC_TENANT_PRODUCT_NAME=$productName" `
  --tag lume-tenant-web:<sha> .
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

Nunca grave tokens, cookies, `SESSION_SECRET` ou o arquivo real de ambiente em
logs, imagens ou repositórios.

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

O Tenant Web precisa alcançar apenas a Tenant API e os destinos HTTPS dos anexos
publicados por ela.

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

Em `NODE_ENV=production`, a readiness também exige `SESSION_SECRET` com pelo
menos 32 bytes, `AUTH_SIMULATION_ENABLED=false` e
`LUME_TENANT_WHATSAPP_DATA_SOURCE=api`. Configuração inválida retorna `503`,
marca `configuration=invalid` e não consulta a API; nenhum valor secreto é
incluído na resposta.

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
8. Em uma conversa `human-active` atribuída ao usuário, valide **Encerrar
   atendimento** e confirme que o frontend envia o comando versionado
   `return-to-bot`. A conversa deve permanecer no histórico e voltar ao estado
   autoritativo do bot; conflito ou recusa da Tenant API não pode ser apresentado
   como sucesso. Com outro atendente autenticado, confirme que a interface e a
   Server Action recusam a mesma ação e que uma chamada direta à Tenant API
   recebe `403` sem alterar a versão. A exceção de Gerência/Diretoria só poderá
   entrar neste canário depois que a API publicar permissão, motivo e auditoria
   explícitos. Confirme também que a interface não oferece `close` como sinônimo
   dessa ação e que um uso autorizado desse comando técnico nunca elimina o
   histórico: o próximo contato deve reabrir a mesma conversa canônica.
9. Verifique o sino em usuários de departamentos diferentes e confirme que cada
   um recebe somente notificações do próprio escopo. No Comercial, valide o
   aviso de novo orçamento pendente.
10. Confirme os grupos **Geral**, **Cadastros**, **Comercial**, **Pessoas** e
    **Administração** na sidebar,
    o envio de suporte pelo provedor e, ao simular uma falha autorizada, o
    `mailto:` com identificação do solicitante; confirme também que `/users`
    exige uma permissão `users:*` compatível e que `/license` continua negada
    fora de Gerência ou sem `license:view`.
11. Confirme que o cadastro oferece somente conta de colaborador, que payloads
    de criação `client` e `document-portal` são recusados e que contas legadas
    continuam editáveis sem permitir troca do modo de acesso.
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
