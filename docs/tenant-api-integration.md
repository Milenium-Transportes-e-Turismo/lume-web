# Integração com a Lume Tenant API

Gestão documental usa `/document-management/*` via gateway server-only. Uploads
são multipart, mutações recebem `commandId`, arquivos passam por Route Handler
autenticada e respostas são validadas com Zod. Consulte
[`document-management.md`](document-management.md).

O frontend acessa apenas a URL server-side configurada em
`LUME_TENANT_API_URL`. Tokens da API ficam em cookie `httpOnly` criptografado e
não são expostos a componentes client-side.

## Endpoints integrados

| Recurso       | Endpoints                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação  | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password/forgot`, `/auth/password/change`                           |
| Usuários      | `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/password-reset`                   |
| Documentos    | `GET /document-management/document-types`, `GET/POST /document-management/requests`, `POST /document-management/requests/batch` |
| Administração | `GET /administration/usage/summary`, `GET /administration/usage/requests`                                                       |
| Perfil        | `GET /users/me/profile`, `PUT /users/me/profile-picture`, `PATCH /users/me/password`                                            |
| Permissões    | `GET /permissions`                                                                                                              |
| Notificações  | `GET /notifications`, `POST /notifications/:notificationId/read`                                                                |
| Licença local | `GET /license/status`                                                                                                           |
| WhatsApp      | `GET /whatsapp/conversations`                                                                                                   |
| WhatsApp      | `POST /whatsapp/conversations`                                                                                                  |
| WhatsApp      | `GET /whatsapp/conversations/dashboard`                                                                                         |
| WhatsApp      | `GET /whatsapp/conversations/:id`                                                                                               |
| WhatsApp      | `GET /whatsapp/conversations/:id/messages`                                                                                      |
| WhatsApp      | `GET /whatsapp/conversations/:id/transitions`                                                                                   |
| WhatsApp      | `POST /whatsapp/conversations/:id/actions/take-over`                                                                            |
| WhatsApp      | `POST /whatsapp/conversations/:id/actions/return-to-bot`                                                                        |
| WhatsApp      | `POST /whatsapp/conversations/:id/actions/forward`                                                                              |
| WhatsApp      | `POST /whatsapp/conversations/:id/actions/mark-read`                                                                            |
| WhatsApp      | `POST /whatsapp/conversations/:id/actions/close`                                                                                |
| WhatsApp      | `POST /whatsapp/conversations/:id/messages`                                                                                     |
| Históricos    | `GET/POST/PATCH /whatsapp/history-imports/*`                                                                                    |
| Propostas     | `GET /whatsapp/quote-proposals?stage=pending\|sent\|approved\|cancelled&search=&createdFrom=&createdTo=`                        |
| Propostas     | `GET /whatsapp/quote-proposals/:id`                                                                                             |
| Propostas     | `POST /whatsapp/quote-proposals/:id/documents`                                                                                  |
| Propostas     | `POST /whatsapp/quote-proposals/:id/send`                                                                                       |
| Propostas     | `POST /whatsapp/quote-proposals`                                                                                                |
| Propostas     | `PATCH /whatsapp/quote-proposals/:id/decision`                                                                                  |
| Propostas     | `PATCH /whatsapp/quote-proposals/:id/status`                                                                                    |

As rotas acima são relativas ao prefixo configurado, normalmente
`http://localhost:3333/api/v1` no desenvolvimento.

## Importação assistida de históricos

`/api/whatsapp-history-import/*` é uma Route Handler com lista explícita de
caminhos permitidos. Ela encaminha o corpo como stream, mantém o bearer token
somente no servidor e preserva apenas os cabeçalhos de conteúdo necessários. A
renovação da sessão segue o mesmo executor autenticado usado pelas ações do
Painel WhatsApp.

A tela envia os ZIPs sequencialmente. O progresso e os erros são exibidos por
arquivo, portanto um backup inválido não interrompe os demais. Depois da revisão
manual, o download e a aplicação usam uma única planilha consolidada. Configure
`LUME_TENANT_API_WHATSAPP_IMPORT_TIMEOUT_MS` acima da janela esperada para um ZIP
grande, sem remover os limites de segurança da Tenant API.

No modo Android completo, a mesma fronteira usa as rotas
`android-database-uploads`: inicia ou retoma o envio, transmite o
`msgstore.db.crypt15` em blocos de 16 MiB e confirma cada deslocamento. A tela
mostra os bytes efetivamente recebidos e uma interrupção continua do último
bloco confirmado. A chave efêmera e a situação/departamento são enviados apenas
na confirmação final; a resposta nunca devolve a chave. Depois da validação, a
tela consulta o lote enquanto o status for `applying` e apresenta mensagens,
conversas e blocos já processados.

Depois da aplicação, o ZIP da pasta `Media` usa um protocolo retomável: a tela
inicia o envio, transmite blocos de 16 MiB a partir do deslocamento confirmado
pela API e solicita a conclusão. A vinculação ocorre em segundo plano; a tela
consulta o manifesto periodicamente para mostrar arquivos conferidos e
armazenados. Selecionar novamente o mesmo nome e tamanho retoma o envio parcial
sem reiniciá-lo.

Uma conversa já aplicada pode participar de um novo lote sem duplicar mensagens
nem bloquear as demais. Arquivos realmente presentes em cada ZIP são retidos
pela Tenant API e passam a usar a mesma rota autenticada das mídias correntes.

## Sessão e renovação

1. O login é enviado por uma Server Action à Tenant API e só aceita uma
   resposta de sessão completa. Respostas de estado da conta são apresentadas
   com mensagens seguras; o formato legado `passwordChangeRequired` é recusado
   como incompatível e não cria cookies.
2. A sessão necessária para renderização e o par de tokens são armazenados em
   cookies separados, criptografados com `SESSION_SECRET`.
   Sessões maiores que um cookie — por exemplo, usuários com um catálogo amplo
   de permissões — são segmentadas em partes de até 3.500 caracteres e
   recompostas somente no servidor.
3. Antes de uma navegação protegida, o Proxy identifica access tokens próximos
   do vencimento e encaminha a rotação para `GET /auth/refresh-session`.
4. O Route Handler renova o par de tokens, atualiza os cookies e devolve o
   usuário à URL local original. A URL de retorno é validada para impedir
   redirecionamento externo.
5. Server Actions também podem renovar o token e repetir uma mutação uma única
   vez após `401`.
6. Falha de renovação passa por `GET /auth/session-expired`, remove os dois
   cookies locais e exige novo login.
7. O polling do WhatsApp usa uma Route Handler local autenticada. A Route
   Handler envia o JWT à Tenant API e pode renovar o par de tokens; o navegador
   nunca recebe esses tokens.

Carregamentos paralelos de uma mesma página compartilham uma única execução
autenticada. Isso evita duas rotações concorrentes do mesmo refresh token.
Server Components permanecem somente leitura em relação a cookies, conforme o
modelo de execução do Next.js App Router.

## Contratos

Respostas são validadas antes de chegar às páginas. Permissões permanecem
strings opacas: o frontend usa o catálogo retornado por `GET /permissions` e
não mantém uma lista fechada para rejeitar novos códigos válidos.

A criação de usuário ocorre em três etapas: dados básicos, seleção de um ou mais
departamentos e seleção das permissões compatíveis retornadas em
`permissionsByDepartment`. Os códigos originais continuam sendo enviados sem
alteração à API; rótulos de recurso e ação são apenas apresentação. Permissões
implícitas publicadas no catálogo não são oferecidas para remoção.

O departamento estabelece o limite estrutural e a permissão individual
autoriza a página ou ação dentro desse limite:

- `/users` exige vínculo Gerência e ao menos uma permissão entre `users:view`,
  `users:create`, `users:update` e `users:manage`;
- `/license` exige vínculo Gerência e `license:view`;
- `/whatsapp-conversations` e `/quote-proposals` exigem vínculo Comercial e
  `whatsapp-conversations:manage`.

A sidebar organiza os itens em **Geral**, **Comercial** e **Administração**.

O estado da licença segue o contrato atual da API:

- `active`: licença dentro da validade;
- `grace`: licença no período de tolerância.

A navegação e a própria Server Page de `/license` aplicam as duas condições:
funcionário ativo vinculado a Gerência e permissão `license:view`.

## Contrato do painel WhatsApp

O adapter `LumeApiWhatsAppConversationRepository` é server-only e valida com
Zod as respostas da Tenant API. O `companyId` retornado é mantido no domínio
para auditoria, mas nunca é aceito do navegador nem enviado em filtros: o
backend deriva o tenant exclusivamente do JWT.

As quatro dimensões canônicas consumidas são:

- `department`: o Painel WhatsApp oferece apenas as nove filas operacionais
  `commercial`, `purchasing`, `controlling`, `personnel-department`,
  `financial`, `management`, `maintenance`, `monitoring` e `operations`;
- `conversationState`: `bot-active`, `waiting-for-customer`,
  `sent-to-human`, `human-active`, `closed`;
- `flowStep`: `main-menu`, `commercial-menu`, `quote-data-collection`,
  `quote-summary-confirmation`, `quote-send-pending`,
  `commercial-follow-up-menu`, `human-service`, `closed`;
- `requestStatus`: `not-started`, `collecting-information`,
  `waiting-for-customer`, `under-review`, `approved`, `rejected`,
  `cancelled`; esta dimensão é exibida e filtrada como status exclusivamente
  Comercial.

O adapter agrega todas as páginas da lista de conversas, evitando limitar as
filas aos primeiros 100 registros. O detalhe carrega as 100 mensagens mais
recentes e permite buscar páginas anteriores sob demanda, preservando a posição
de leitura e evitando renderizar milhares de registros de uma vez. Cada página inclui
metadados de anexos, `deliveryStatus`, tentativas e motivo de falha. A
solicitação atual é exibida com campos estruturados e sua própria versão.
Campos operacionais internos da API, como identificadores e leases de claim do
dispatcher, hashes ou chaves de persistência das transições, são descartados
pelo adapter e não chegam ao domínio nem aos componentes do painel.

Os valores legados ainda reconhecidos pelo contrato de leitura nunca são
mostrados como códigos. A interface usa rótulos em português e restringe
seletores, filtros e encaminhamentos às nove filas do MVP. O departamento atual
também é removido das opções de encaminhamento.

O nome exibido na caixa de entrada prioriza o contato salvo na agenda do Lume.
Quando a importação histórica ainda possui somente o telefone, o painel tenta o
nome confirmado no orçamento atual e, se ele também não existir, apresenta
`Contato não identificado`. O telefone permanece em seu campo próprio e nunca é
promovido a nome do contato.

Toda escrita envia:

```json
{
  "commandId": "<uuid novo>",
  "expectedVersion": 7
}
```

`forward` acrescenta `targetDepartment`. Em HTTP 409, a resposta tipada lê
`details.currentVersion`; a Server Action recarrega o detalhe e devolve o estado
atual ao painel. Nenhuma ação sobrescreve silenciosamente uma versão divergente.
Na interface, o departamento atual é removido das opções de destino, evitando
um encaminhamento sem mudança de fila.

O envio pelo atendente exige que a conversa esteja em `human-active` e atribuída ao
usuário autenticado. O corpo é:

```json
{
  "commandId": "<uuid estável da tentativa lógica>",
  "idempotencyKey": "<uuid estável para reenvio>",
  "expectedVersion": 7,
  "text": "Mensagem do atendente"
}
```

O painel preserva texto e identificadores em 409 ou falha de comunicação. Em
falha ambígua de comunicação, preserva também o `expectedVersion` original:
isso permite repetir exatamente o mesmo comando caso a API tenha persistido a
mensagem e apenas a resposta tenha se perdido. Somente um 409 explícito,
acompanhado do estado atual recarregado, avança a versão da tentativa lógica.
Assim, uma nova tentativa da mesma mensagem não cria intencionalmente um segundo
comando nem altera o fingerprint idempotente. Em sucesso, a API retorna
`{ "message": ..., "conversation": ... }`;
`message.deliveryStatus` começa em `pending`. O polling posterior apresenta
`sent`, `delivered`, `read` ou `failed`, incluindo a tentativa e seu erro quando
publicados pela API.

Leitura da API exige `whatsapp-conversations:view` ou
`whatsapp-conversations:manage`; este painel de gestão mantém
`whatsapp-conversations:manage` tanto na rota quanto nas Server Actions.

Não há SSE publicado. O MVP atualiza a lista por polling server-side a cada
quatro segundos quando a aba está visível, usa backoff exponencial até trinta
segundos em falhas e reduz consultas com a aba oculta. Cada ciclo solicita
somente uma página de 25 conversas com filtros server-side; `meta` e `summary`
fornecem paginação e indicadores sem percorrer as demais páginas. Requisições
substituídas são canceladas e HTTP 429 permanece 429 para acionar o backoff. O
detalhe completo só é
recarregado quando a conversa selecionada muda de versão ou `updatedAt`, ou
enquanto há uma mensagem outbound `pending`. A última condição é necessária
porque uma falha de entrega pode atualizar a mensagem sem incrementar a versão
da conversa.

## Configuração

```dotenv
LUME_TENANT_API_URL=http://localhost:3333/api/v1
LUME_TENANT_API_TIMEOUT_MS=5000
LUME_TENANT_API_DOCUMENT_REVIEW_TIMEOUT_MS=300000
SESSION_SECRET=replace-with-at-least-32-random-characters
AUTH_SIMULATION_ENABLED=false
LUME_TENANT_WHATSAPP_DATA_SOURCE=api
```

Em produção, a URL da API deve usar HTTPS e autenticação simulada é sempre
recusada. O datasource de WhatsApp usa `api` por padrão; `mock` exige ativação
explícita fora de produção e é recusado quando `NODE_ENV=production`.

`LUME_TENANT_WHATSAPP_DATA_SOURCE` pertence exclusivamente ao Tenant Web e
seleciona entre o adaptador real da Tenant API (`api`) e os dados locais de teste
(`mock`). Essa variável não escolhe quem processa os eventos do WhatsApp. A
automação é executada pela própria Tenant API, e o Tenant Web permanece
configurado com `api` sem conhecer consumidores internos.

## Ações e limites reais do contrato WhatsApp

A Tenant API publica cinco comandos de estado do painel — assumir, devolver ao
bot, encaminhar, marcar como lida e encerrar — além do envio de texto pelo
atendente. O frontend usa a rota canônica `actions/close`; a rota
`close-after-rejection` existe somente como alias legado no backend e não é
emitida pelo painel.

Para iniciar um atendimento, o painel envia o telefone a
`POST /whatsapp/conversations`. A Tenant API normaliza o número, escolhe o canal
ativo e cria ou reutiliza a conversa canônica antes de atribuir o usuário atual.
Uma conversa encerrada expõe **Iniciar atendimento**, que reutiliza `take-over`
para bloquear o bot, limpar o encerramento e ativar o atendente sem duplicar o
histórico.

O encerramento exige conversa aberta e ausência de proposta ativa. No MVP,
`hasApprovedQuoteRequest=true` não bloqueia mais o botão: a política anterior
permanece no domínio, desabilitada por uma constante explícita, para possível
reativação coordenada com a Tenant API. Solicitações em
`collecting-information`, `waiting-for-customer` ou `under-review`, assim como
um PDF ainda em envio, continuam bloqueando a ação. A resposta da Tenant API
permanece autoritativa; uma recusa é apresentada ao usuário e não altera o
snapshot local como se houvesse sucesso. Uma conversa `waiting-for-customer`
com proposta aprovada, sem atendente responsável, pode executar **Devolver ao
bot** para retomar o menu de acompanhamento; a mesma ação continua bloqueada
para um resumo ainda aguardando confirmação. Para proposta recusada, a Tenant
API exige um motivo efetivo: o texto confirmado pelo atendente ou o motivo já
persistido na decisão. O próximo inbound do mesmo telefone reutiliza a conversa
canônica e reinicia o bot em `bot-active/main-menu`; histórico, proposta e
auditoria permanecem preservados.

A matriz ainda não publica comandos de painel para aguardar cliente ou cancelar
solicitação. Esses controles permanecem desabilitados e identificados como
indisponíveis; o frontend não inventa rotas nem altera dimensões diretamente.

O detalhe agrega também o log append-only de transições, com ator, versões e as
quatro dimensões antes/depois. A visão operacional não renderiza o log técnico
completo nem o objeto livre `structuredData`, mas projeta as transições de
encerramento em um histórico útil: data e hora, atendente responsável e motivo.
Os motivos de falha das tentativas de envio continuam vinculados às respectivas
mensagens.

Em conversa encerrada, o cabeçalho usa a transição `close` ou
`close-after-rejection` mais recente para mostrar **Encerrado por**. O comando
de encerramento depende da permissão `whatsapp-conversations:manage`, não de a
conversa permanecer no departamento Comercial; por isso o painel comercial
pode concluir um contato já encaminhado a outra fila.

O histórico de mensagens e o compositor ficam no painel lateral aberto por
**Abrir chat**. A apresentação usa o componente
[`Message`](https://ui.shadcn.com/docs/components/base/message) do shadcn/ui
para distinguir mensagens recebidas e enviadas, mostrar o estado de entrega e
listar anexos. O rodapé de uma mensagem enviada exibe a data, a hora e
`sentBy.name`, publicado pela Tenant API; quando esse campo não existe em um
registro antigo, a atribuição atual é usada somente como fallback visual.

O conteúdo binário de imagem, áudio e vídeo é solicitado apenas quando o usuário
seleciona **Carregar mídia**; referências históricas sem retenção ficam
identificadas como indisponíveis e não disparam requisições automáticas.

O renderer usa `kind` e `media`: imagem e figurinha são exibidas, áudio e vídeo
possuem controles nativos e documentos mantêm o link de abertura. Sem URL
HTTPS fornecida pelo provedor, o chat conserva os metadados e sinaliza que o
conteúdo não está disponível, sem inventar ou buscar o arquivo no navegador.

O compositor envia texto ou um anexo por clique, `Enter` ou `NumpadEnter`;
`Shift+Enter` preserva a quebra de linha. Imagens, vídeos, áudios, documentos,
arquivos ZIP/RAR/7z e contatos `.vcf` usam um Route Handler multipart autenticado e entram na mesma
outbox durável das mensagens de texto. Uma conversa ainda sem responsável pode ser assumida dentro
do próprio painel lateral. O painel usa toda a largura do mobile e, no desktop,
possui limite de 84 rem, o dobro do limite anterior de 42 rem, sem rolagem
horizontal. Todas essas escritas usam Server Actions: o
navegador não recebe credenciais e não chama o provedor.

O frontend nunca contorna essas ausências chamando cache, Evolution,
`lume-edge-agent` ou `lume-control` diretamente.

## Contrato futuro de arquivos, importação e exportação genéricos

O Tenant Web não converte documentos ou planilhas. O contrato de roteirização
aceita `pelias` como origem geográfica ativa e mantém `nominatim` somente para
compatibilidade durante atualizações. Fora dos contratos já publicados para
documentos e roteirização, quando a Tenant API publicar
o contrato definitivo, a integração deve ser criada como gateway server-only e
tipos validados com Zod. A tela futura poderá enviar um arquivo, consultar o
progresso do lote, apresentar erros por registro e baixar o resultado
autenticado; não poderá decidir formatos, estados ou permissões localmente.

Até que endpoints, DTOs e limites sejam estabilizados pela Tenant API, nenhum
endpoint é presumido nesta aplicação. Esse desenho reserva a fronteira sem
criar uma interface incompatível ou uma segunda implementação de conversão.

## Fila e envio de propostas comerciais

A página autenticada de Orçamentos consome as quatro filas exclusivas da Tenant
API em `/quote-proposals`. Pendentes, Enviadas, Aprovadas e Canceladas são abas
selecionáveis por `tab=pending|sent|approved|cancelled`; as URLs antigas são
mantidas apenas como redirecionamentos de compatibilidade. Os gráficos e os
motivos de cancelamento são mostrados no Dashboard Comercial.
O backend seleciona solicitações comerciais em `under-review`; o navegador não
monta a fila a partir de dados locais e não recebe credenciais da API. O adapter
server-only `LumeApiQuoteProposalRepository` agrega a paginação, valida o
contrato com Zod e expõe apenas o resumo necessário ao atendente. Tanto
os quatro stages percorrem todas as páginas informadas por `totalPages`; os
filtros automáticos de pesquisa, rota e período não ficam limitados aos
primeiros 100 registros. A resposta inclui `summary` com as contagens
`pending`, `sent`, `approved`, `cancelled` e a agregação
`cancellationReasons`. O dashboard usa esse resumo independente da página e
não soma apenas os itens visíveis.

A sidebar usa um único item **Orçamentos** e publica nele a contagem numérica
autoritativa de **Pendentes**. Valores internos como `all`, stages e códigos de tipo de serviço
permanecem no contrato, mas são traduzidos antes de chegar ao atendente.

Cada confirmação aceita de um a cinco PDFs. Cada arquivo mantém limite
individual de 10 MiB, validação de extensão, MIME type e assinatura `%PDF-`.
O envio executa duas fases explícitas e idempotentes:

1. depois da confirmação visual do atendente, a Server Action valida todos os
   arquivos antes de qualquer escrita e envia todos os multiparts para
   `POST /whatsapp/quote-proposals/:id/documents`, com a mesma versão inicial;
2. somente depois que o último upload foi persistido, chama
   `POST /whatsapp/quote-proposals/:id/send` para cada documento, em ordem, com
   outro `commandId`, o `proposalDocumentId` e a versão devolvida pelo envio
   anterior.

Depois dos uploads, a Server Action forma a lista ordenada e exata dos
identificadores persistidos. Todos os `/send` do lote recebem o mesmo
`batchId` e o mesmo `batchDocumentIds`, além do `proposalDocumentId` individual.
Esses valores, assim como os `commandId`, permanecem estáveis em retries. A
Tenant API valida que a lista pertence à mesma solicitação e marca somente os
documentos explicitamente nomeados; PDFs órfãos ou uploads concorrentes ficam
fora. Esse contrato impede que uma confirmação muito rápida do primeiro PDF
conclua o orçamento antes que os demais pertençam ao lote. Confirmações só
avançam para `Aguardando cliente` depois que todos os membros estiverem `sent`;
qualquer `failed` mantém o lote incompleto.

A Tenant API repete a validação completa, incluindo assinatura final, hash
SHA-256 e isolamento pelo tenant. Replays idempotentes de upload são aceitos
mesmo depois da criação do lote; uploads realmente novos são recusados enquanto
o lote estiver em processamento. Em `409`, o frontend preserva também
`details.currentVersion`. Dessa forma, uma falha ambígua não cria outro
documento, lote ou mensagem.

Um sucesso do endpoint `/send` significa que a mensagem e a outbox foram
registradas como `pending`; ainda não significa entrega ao WhatsApp. A fila
mostra o documento como `queued` e impede novo envio. Somente o resultado
inequívoco do provedor altera a conversa para `waiting-for-customer`
(`Aguardando cliente`).

O histórico enviado é agrupado por `conversationId` e `quoteRequestId`. Assim,
duas conversas ou dois ciclos de orçamento do mesmo telefone não são
misturados. `GET /whatsapp/quote-proposals/:id` publica todos os documentos da
solicitação; o botão **Visualizar PDF** abre primeiro uma lista quando houver
mais de um e cada item oferece a visualização individual pela Route Handler
autenticada.

Ao confirmar o primeiro envio, a Tenant API vincula automaticamente a conversa
ao usuário autenticado quando ainda não existe atendente responsável. O
frontend apenas reapresenta a atribuição retornada; não tenta inferir ou
persistir o responsável no navegador.
`Criar orçamento`, disponível no detalhe da conversa comercial assumida pelo
usuário atual, usa React Hook Form, Zod e os componentes oficiais `Field`,
`Input`, `Select`, `Checkbox`, `Textarea` e `Dialog`; o nome é preenchido pelo
último orçamento e permanece editável. O botão `Cadastrar` chama
`POST /whatsapp/quote-proposals`, cria uma nova sequência autoritativa e devolve
a solicitação para a fila pendente. O mesmo modal aceita um PDF validado e
oferece `Cadastrar e enviar`: depois de criar, ele reutiliza exatamente as
operações idempotentes de upload e envio, com `commandId` distintos e a versão
retornada pela criação. Se o envio falhar, a solicitação permanece na fila e o
documento já persistido é reutilizado na tentativa seguinte. A ação não é
exibida quando a conversa associada está encerrada; o estado canônico
`conversationState` vem no item da fila e também é validado novamente pela
Tenant API ao receber uma tentativa de criação.
Aprovação e recusa usam
`PATCH /whatsapp/quote-proposals/:id/decision`; a recusa exige motivo e qualquer
decisão registrada é final. A API rejeita uma segunda decisão e a interface
mantém Aprovar e Recusar desabilitados depois do primeiro resultado. O botão
`Visualizar PDF` acessa uma Route Handler autenticada do Tenant Web, que faz
proxy do conteúdo da Tenant API sem expor o bearer token ao navegador. A
consulta e o download aceitam leitura ou gestão do módulo Comercial/WhatsApp,
mas sempre exigem vínculo com o departamento Comercial; permissões de outro
departamento não ampliam esse acesso.

As rotas de Orçamentos não oferecem criação avulsa. O atendente abre a conversa,
assume o atendimento e cria o orçamento no próprio workspace, revisando ou
completando o resumo — data de saída obrigatória, horário opcional — e
reutilizando o mesmo fluxo idempotente de criação, upload e envio. O botão
**Lista de orçamentos** consulta as quatro etapas com
`conversationId=<uuid>`, elimina duplicatas por solicitação e apresenta todos
os PDFs vinculados. O Painel WhatsApp permite alterar manualmente o status do
orçamento corrente por `PATCH /whatsapp/quote-proposals/:id/status`; a
interface envia `expectedVersion`, `commandId` e motivo quando obrigatório, e
então recarrega a conversa autoritativa.

O objeto livre `structuredData` continua validado no adapter, mas não é
renderizado para o atendente. A tela exibe apenas o resumo confirmado com
rótulos operacionais e os metadados seguros do PDF.

A consulta da fila e o badge da sidebar são atualizados periodicamente. A visão
geral consulta `stage=pending&page=1&pageSize=1` e usa o `summary` para todos os
gráficos e motivos de cancelamento, sem quatro leituras redundantes nem totais
derivados da paginação. Cada subpasta carrega integralmente seu stage para os
filtros automáticos. A fila pendente usa intervalo de cinco segundos,
foco/visibilidade e botão Atualizar; a navegação atualiza somente o badge
pendente a cada quinze segundos pela mesma consulta leve e também recebe o
total emitido pela própria tela. O upload multipart usa timeout de trinta
segundos, enquanto consultas e comandos JSON mantêm cinco segundos.

## Senhas, perfil e suporte

Usuários cadastrados em `/users` recebem uma senha inicial de provisionamento,
mas ela não pode abrir sessão. Depois de validar essa credencial, a Tenant API
responde `ACCOUNT_PASSWORD_SETUP_REQUIRED` com HTTP 403 e o login orienta o
usuário em um Dialog para informar e confirmar sua senha definitiva. O desafio
opaco é consumido por `POST /auth/password/change`; após a confirmação, o
frontend retorna automaticamente para `/login` e nenhuma sessão é criada com a
senha inicial. `ACCOUNT_INACTIVE` usa HTTP 403 e `ACCOUNT_SUSPENDED`, HTTP 423.
Credenciais incorretas continuam indistinguíveis em HTTP 401.

As três telas públicas de autenticação mostram `Código do erro: <CODE>` junto à
mensagem amigável. O frontend preserva o código devolvido pela API e usa códigos
determinísticos para validação local, timeout, indisponibilidade, limite de
tentativas, falha de inicialização da sessão e erro inesperado. O usuário pode
informar esse código ao suporte sem precisar compartilhar senha ou token.

**Esqueci minha senha** abre `/forgot-password`. A Server Action normaliza o
identificador e chama `POST /auth/password/forgot`; a confirmação não distingue
uma conta existente de uma inexistente e, portanto, impede enumeração. O token
entregue por e-mail direciona para
`/reset-password?token=...`, única tela que renderiza o formulário de nova
senha. O token opaco é consumido por `POST /auth/password/change`. O login não
interpreta o desafio de primeiro acesso como sessão nem persiste access/refresh
token antes da senha definitiva.

Alterar a senha em `/profile` revoga os tokens atuais e leva o usuário de volta
ao login. A API compara a nova senha com o hash atual e com o histórico de
hashes; texto puro nunca é armazenado. A mesma página aceita foto JPEG, PNG ou
WebP de até 512 KB, com largura e altura entre 128 e 2048 pixels. O frontend
valida assinatura, decodificação e dimensões antes do envio; a Tenant API repete
a validação e aceita JSON de até 1 MB para comportar o data URL sem reabrir os
limites específicos dos webhooks.

O reset administrativo e a recuperação pública dependem de entrega de e-mail
explicitamente configurada na Tenant API. Sem essa configuração, o painel não
afirma que houve envio. A resposta pública permanece genérica; detalhes
operacionais ficam nos logs seguros da API.

Na rota `/users`, a listagem oferece pesquisa e filtros server-side por
departamento, permissão efetiva e estado, com paginação autoritativa. O catálogo
do filtro é o publicado por `GET /permissions` e inclui permissões individuais e
automáticas; a Tenant API resolve o acesso efetivo antes de aplicar o filtro. O
cadastramento possui três etapas obrigatórias e somente a ação final da etapa de
permissões envia os dados. Nomes de usuário precisam conter ao menos uma letra.
Na edição, cada bloco possui **Selecionar todas** com estado parcial. Perfis com
autoridade de gestão também podem trocar **Candidato — somente documentos** por
**Colaborador — painel autorizado**; a promoção exige departamento e permissões
compatíveis antes do envio à Tenant API.

`isAdministrator` é uma autoridade explícita da Tenant API, não um cargo, mas
não pode ser atribuída pelo Tenant Web. O cadastro força
`isAdministrator=false`; a atualização omite esse campo mesmo diante de um
payload forjado. Uma conta administradora previamente provisionada é exibida
como somente leitura e continua recebendo o catálogo derivado pela API. O
provisionamento ou a troca dessa autoridade exige um procedimento
administrativo externo ao painel, com auditoria e preservação de ao menos um
administrador ativo.

Falhas nas ações de usuário e perfil preservam o código público da Tenant API
(ou um fallback como `HTTP_413`) e o exibem no toast em uma linha própria para
facilitar o atendimento de suporte.

O ciclo de conta é:

- `active`: autenticação e sessões permitidas;
- `inactive`: conta desativada até ativação explícita;
- `suspended`: bloqueio temporário com motivo obrigatório e término calculado
  por quantidade de dias ou data final.

`users:update` habilita **Editar acesso**: dados, departamentos, permissões e
recuperação de senha. `users:manage` habilita somente **Gerenciar acesso**:
ativar novamente, desativar ou suspender. Não existe checkbox nem ação
`users:delete`, porque a API não oferece exclusão de usuários. A Tenant API
persiste o estado, o prazo e o motivo e também invalida sessões conforme sua
política; o frontend não decide o estado efetivo da autenticação.

`/support` envia primeiro `POST /support/requests` pela Tenant API. O backend
deriva nome, usuário e e-mail do JWT e é o único componente que conversa com o
provedor configurado. Em sucesso, o painel apresenta o protocolo persistido.
O fallback seguro `mailto:` para `taiane.karine@mileniumturismo.com.br`, com
cópia para `taianekas.dev@outlook.com`, só aparece quando há falha de transporte
até a Tenant API ou quando uma falha de provedor retorna
`details.fallbackAllowed=true`. Erros de autenticação, permissão, validação ou
resposta inválida não liberam esse botão. No fallback, assunto e corpo são
codificados preservando acentos e quebras de linha e incluem automaticamente
nome, usuário e e-mail do perfil autenticado; o envio ainda depende da
confirmação do usuário no aplicativo de e-mail.

`profile:view`, `profile:update`, `support:view` e `support:create` são
permissões implícitas de autoatendimento publicadas pela Tenant API. Elas são
somadas às permissões individuais sem criar um atalho para páginas de outro
departamento.

## Roteirização

O gateway server-only envia `POST /routing/calculations` para a Tenant API. A
Server Action valida origem, destino, paradas, veículo, combustível e data antes
do envio, e a resposta completa é validada novamente com Zod. O token continua
restrito ao servidor Next.js.

O navegador nunca chama Nominatim ou Valhalla e não calcula distância,
combustível, pedágio ou custo. As geometrias retornadas são dados do mapa futuro;
o componente visual não se torna fonte de regra de negócio.

## Dashboard e notificações por departamento

O Server Component do dashboard filtra as conversas pelos departamentos do
usuário antes de serializar a página. Usuários de Operações, por exemplo, não
recebem os indicadores comerciais. A visualização mantém os cartões canônicos,
um gráfico de barras operacional e um gráfico de setores da fila atribuída.

O sino fica no header para todo usuário ativo, independentemente de
departamento ou permissão de módulo. `GET /notifications` deriva o usuário e os
departamentos exclusivamente do JWT e retorna uma projeção já filtrada. Assim,
um novo orçamento pendente aparece para usuários vinculados ao Comercial, sem
ser enviado aos demais departamentos.

A gaveta oficial `Drawer` atualiza essa projeção por polling. Quando um usuário
Comercial também possui `whatsapp-conversations:manage`, o frontend acrescenta
a inspeção de automações pausadas pela Route Handler autenticada do painel.
Nenhum desses dados transforma o navegador em fonte de verdade.

O número exibido no sino usa `unreadTotal`/`unreadCount`, e não o total de
pendências de negócio. Ao abrir o Drawer, o frontend atualiza o badge de forma
otimista e envia `POST /notifications/:notificationId/read`, sem body ou versão
esperada. A Tenant API persiste a leitura para o usuário autenticado e responde
com `notificationId`, `pendingTotal`, `unreadTotal`, `markedRead` e `readAt`.
As pendências continuam visíveis até saírem da fila. Se a confirmação falhar,
o snapshot atual fica registrado localmente como fallback e a gaveta informa a
falha de sincronização; uma resposta bem-sucedida remove qualquer fallback do
item. Novos ciclos pendentes retornados pela API voltam ao badge.

Após `PUT /users/me/profile-picture` ser confirmado, **Meu perfil** publica a
foto no provider do shell. Sidebar, histórico de mensagens e demais superfícies
podem consumir o componente compartilhado `CurrentUserAvatar`; isso evita
duplicar cache ou alterar `avatar.tsx`/`message.tsx`, que permanecem como bases
instaladas do shadcn/ui.
