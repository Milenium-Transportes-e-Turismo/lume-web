# Arquitetura do Lume Tenant Web

Gestão documental usa o shell existente e um gateway server-only. Contas
legadas no modo `document-portal` reduzem a navegação a **Meus documentos**; a
Tenant API continua autoritativa para isolamento, revisão e download. Novos
candidatos não recebem esse tipo de conta: o produto aguarda um contrato de link
seguro.

```text
Navegador
  -> Next.js / Server Actions
  -> LUME_TENANT_API_URL
  -> PostgreSQL local do cliente
```

O plano de controle não participa de login, autorização ou operação diária.
Sessão, cookies e segredos deste frontend são exclusivos da instalação.

Configuração passa pelos schemas Zod de `src/env.ts`. `src/env.server.ts`
mantém leitura privada server-only e lazy para aceitar injeção no início do
contêiner; `src/env.public.ts` expõe somente as duas variáveis textuais
`NEXT_PUBLIC_*`. Detalhes de build, `.env` e rotação estão em
[environment-configuration.md](environment-configuration.md).

As permissões são strings opacas no formato `recurso:ação`. O backend é a
autoridade do catálogo e pode introduzir novas permissões sem exigir uma
publicação imediata do frontend.

A identidade principal vem do design system Lume e não é configurável por
tenant. `NEXT_PUBLIC_TENANT_NAME` e `NEXT_PUBLIC_TENANT_PRODUCT_NAME` fornecem
somente contexto textual. Departamentos e módulos específicos permanecem
configuráveis por tenant.

A permissão individual, no formato `recurso:ação`, autoriza a operação; a área
de atuação limita o escopo dos dados. O formulário de criação de colaborador
segue três etapas: dados básicos,
seleção de um ou mais departamentos e seleção das permissões compatíveis
publicadas por `GET /permissions`. A lista de departamentos ainda é um espelho
local do catálogo estático da API; permissões implícitas permanecem sob
autoridade da Tenant API e não podem ser removidas pelo navegador.

As opções oferecidas pelo Tenant Web para um novo colaborador são Comercial,
Compras, Controladoria, Departamento Pessoal, Financeiro, Gerência, Manutenção,
Monitoramento, Operacional e Tecnologia da Informação. O catálogo técnico da API
também reconhece `client-company`; o Tenant Web reserva esse código para leitura
e edição de contas de cliente legadas e o exclui de novas contas. Registros
legados continuam legíveis para compatibilidade. A configuração dinâmica e a
separação completa de áreas, perfis e delegações dependem de contrato da API.

`/users` exige ao menos uma permissão entre `users:view`, `users:create`,
`users:update` e `users:manage`; a API aplica as restrições do papel e do alvo.
`/license` exige departamento Gerência e `license:view`. Painel WhatsApp e
Orçamentos ainda exigem departamento Comercial e a permissão do módulo. O gate
do Painel WhatsApp só poderá ser removido quando listagem, detalhe, busca e
comandos forem limitados às filas atribuídas; abrir apenas a página hoje
exporia conversas de outros departamentos do tenant.

As conversas exibidas no Painel WhatsApp passam pelo
`LumeApiWhatsAppConversationRepository`, que é server-only. Server Components,
Server Actions e a Route Handler de polling são os únicos consumidores desse
adapter. O datasource padrão é a Tenant API; mock exige flag explícita fora de
produção e é recusado em `production`.

A caixa de entrada nunca materializa todas as conversas do tenant. A Route
Handler encaminha página, pesquisa e filtros para a Tenant API, recebe no
máximo 25 resumos por vez e preserva os totais agregados publicados pelo
backend. As atualizações não se sobrepõem; falhas e HTTP 429 usam backoff sem
gerar rejeições não tratadas no navegador.

O painel envia `expectedVersion` em toda escrita e nunca calcula estados de
destino. A matriz e o isolamento por `companyId` permanecem sob autoridade da
Tenant API. Em conflito 409, o frontend recarrega a conversa antes de permitir
uma nova tentativa. O frontend nunca chama cache, Evolution ou o edge
diretamente.

O workspace usa três regiões no desktop: caixa de entrada paginada, conversa e
contexto operacional. No mobile, a mesma informação vira navegação progressiva
entre lista, conversa e contexto. O domínio projeta a `ServiceSession` atual sem
fundir lifecycle, controle, responsável, fila e prioridade. A projeção legada é
explicitamente identificada; ações não suportadas pela façade ficam
desabilitadas. Comandos de assumir, transferir e retornar à IA carregam
`commandId` e a versão da sessão desde a interação do usuário, e um 409 sempre
substitui o estado exibido pelo snapshot autoritativo recarregado.

A rota `/whatsapp-conversations/import` prepara importações em massa sem criar
uma segunda regra de persistência. O navegador envia um ZIP por vez a uma Route
Handler autenticada, revisa os mapeamentos e solicita uma planilha consolidada.
A Tenant API aplica essa planilha pelo importador oficial. O frontend não tenta
identificar contatos por nome, não decide estados automaticamente e não guarda
tokens ou arquivos de histórico no cliente.

## Shell, tema e estados de carregamento

As rotas autenticadas compartilham `AuthenticatedShell`, montado com os
componentes oficiais do bloco `sidebar-07` do shadcn/ui (`SidebarProvider`,
`Sidebar`, `SidebarInset`, dropdowns e rail). A sidebar usa o catálogo central
de navegação e continua filtrada pelas permissões devolvidas pelo backend. Ela
pode ser recolhida no desktop e funciona como drawer no mobile. O header ocupa
uma única linha, sem margem superior no inset, com breadcrumb da rota e
alternância entre os modos claro e escuro. O acionador da sidebar e o
breadcrumb são adjacentes, sem um separador vertical ornamental. Cabeçalhos de
página usam espaçamento compacto para preservar a área útil antes das filas,
gráficos e catálogos.

A foto do usuário é sincronizada no shell pelo
`CurrentUserProfilePictureProvider`. Ao montar o shell, a Route Handler
autenticada `/api/current-user/profile-picture` recupera a foto persistida na
Tenant API; depois que a API confirma uma alteração em **Meu perfil**, a página
publica o novo `dataUrl` para todas as representações montadas do usuário. A sidebar já consome
`CurrentUserAvatar`; o mesmo componente é reutilizável em mensagens e outros
contextos sem alterar os componentes base do shadcn/ui. A cópia local é
separada por `userId` e serve somente para atualização visual imediata: a
Tenant API continua sendo a fonte de verdade do perfil.

Os itens são organizados em seis grupos:

- **Geral:** Dashboard, Knowledge Base, Meus documentos e Suporte, sujeitos às
  respectivas permissões e com conteúdo filtrado pelo departamento;
- **Cadastros:** Cadastro, Conciliação de Cadastros e Revisões cadastrais,
  conforme as permissões de clientes e histórico;
- **Comercial:** Painel WhatsApp, Contatos e Orçamentos, conforme o vínculo e as
  permissões de atendimento;
- **Operacional:** cálculo de roteirização e custos, conforme as permissões
  `route-planner:view` e `route-planner:calculate`;
- **Pessoas:** Usuários e Gestão documental conforme vínculo e permissões;
- **Administração:** Agentes de IA, Painel administrativo exclusivo de
  administradores, Canais WhatsApp e Licença conforme as permissões e o vínculo
  organizacional. O painel
  apresenta volume, bytes, duração, resultados, usuários e ações humanizadas;
  nunca exibe rotas ou conteúdo das requisições.

O tema usa `next-themes` e os tokens semânticos de `globals.css`; componentes
de domínio não persistem preferência paralela. `src/app/loading.tsx` fornece o
skeleton global de navegação e conteúdo durante transições do App Router.

O dashboard consulta conversas somente pelo repositório server-only da Tenant
API. Os cartões e os gráficos shadcn/Recharts (barras operacionais e setores por
departamento) são calculados a partir dos dados reais retornados:

- **Bot ativo:** `conversationState = bot-active`;
- **Atendente ativo:** `conversationState = human-active`;
- **Automação pausada:** `waiting-for-customer` ou `sent-to-human`;
- **Conversas não lidas:** quantidade de conversas com `unreadCount > 0`.

Na caixa de entrada, os mesmos indicadores são renderizados dentro do componente
que executa o polling. Assim, cartões, lista e detalhe usam o mesmo snapshot e
não divergem após uma transição.

O histórico e o compositor não ocupam permanentemente o detalhe da conversa.
O botão **Abrir chat** abre um `Sheet` com o
componente oficial `Message` do shadcn/ui. Cada item apresenta direção, data,
remetente, estado de entrega e anexos autorizados. O envio pelo atendente parte
desse painel lateral e continua usando apenas uma Server Action e a Tenant API.
Imagem, figurinha, áudio, vídeo e documento são renderizados conforme o
`kind` persistido; nenhum conteúdo de mídia é encaminhado à IA.
O `Sheet` mantém largura total no mobile e chega a 84 rem no desktop,
aproximadamente o dobro do limite anterior de 42 rem. O container e as ações
usam limites flexíveis e `overflow-x-hidden`, portanto textos, contador e botões
não introduzem rolagem horizontal.

O detalhe mantém telefone sob o nome, responsável e canal no cabeçalho; após o
fechamento, o responsável é substituído pelo ator da transição de encerramento. As
dimensões canônicas aparecem em uma grade compacta. Assumir e **Encerrar
atendimento** ficam na coluna operacional; Abrir chat, Encaminhar e Alterar
status ficam na coluna de apoio. Encaminhamento, status, lista de orçamentos e histórico de ações são
modais, evitando que formulários e históricos imponham rolagem permanente à
página. O botão Assumir fica desabilitado assim que houver responsável; a
devolução ao bot usa exclusivamente o comando versionado da Tenant API.

Mensagens enviadas pelo atendente usam `commandId` e `idempotencyKey` estáveis
enquanto o rascunho não for confirmado. A Tenant API persiste a mensagem em
`pending` e publica o processamento assíncrono; o frontend apenas acompanha o
resultado pelo histórico versionado.

Encerrar o atendimento humano usa exclusivamente o comando versionado
`return-to-bot`. A ação só fica disponível para uma conversa `human-active`
atribuída ao usuário autenticado. A interface e a Server Action conferem o
responsável atual e o escopo Comercial; a API também garante a propriedade na
mesma transação da mudança. O estado devolvido substitui o snapshot local e um
conflito recarrega a versão autoritativa.

Gerência e Diretoria poderão encerrar um atendimento humano de outro atendente
somente como supervisão explícita, com permissão própria, motivo obrigatório e
auditoria de ator e data/hora. Enquanto a Tenant API não publicar a autorização,
o DTO e o registro de auditoria correspondentes, o Web mantém a regra do
responsável e não deriva essa exceção de departamento ou administração da
plataforma.

`close` continua sendo o comando atual e distinto para colocar a conversa
canônica no estado técnico temporário `closed`; nunca representa exclusão ou
fechamento definitivo, e o próximo contato reabre a mesma conversa. Ele não é
exposto pela interface nem por uma Server Action como encerramento do
atendimento humano. O alias legado `close-after-rejection` permanece reconhecido
no gateway e na projeção de históricos. Orçamentos e demais processos permanecem
separados da conversa contínua.

## Fronteira para importação e exportação

O navegador não interpreta, converte ou armazena arquivos de negócio. A futura
interface de importação/exportação deve consumir um gateway server-only
publicado pela Tenant API e validar a resposta com Zod. O contrato deve expor,
no mínimo, identificação do lote, estado de processamento, contagens, erros por
registro, metadados seguros do arquivo e um download autenticado.

Tipos e gateways só devem ser adicionados depois que a Tenant API publicar o
contrato definitivo. Esse limite evita duplicar conversores, regras de
segurança, catálogos de MIME e estados de lote entre backend e frontend.

Propostas comerciais usam uma fronteira separada,
`LumeApiQuoteProposalRepository`, sem criar um segundo dono de estado. O
Dashboard Comercial mostra os gráficos calculados pelo `summary` autoritativo
da Tenant API. A rota `/quote-proposals` concentra as quatro filas em abas
controladas por `tab=pending`, `tab=sent`, `tab=approved` e `tab=cancelled`; um documento
só entra em Enviadas quando a confirmação positiva do provedor já estiver
persistida. Canceladas inclui decisões recusadas e cancelamentos, sempre com o
motivo publicado no histórico e no resumo agregado. Os filtros automáticos
operam sobre todas as páginas carregadas pelo adapter server-only, e não sobre
uma amostra da primeira página. Um lote contém no máximo cinco PDFs de 10 MiB e é enviado
em duas fases: todos os uploads usam a versão inicial e terminam antes do
primeiro envio; depois, os envios avançam a versão da conversa em sequência. O
painel gera um `batchId` técnico e a Server Action envia, em todos os comandos,
a mesma lista ordenada `batchDocumentIds` obtida após os uploads. A Tenant API
valida e congela exatamente esses documentos; uploads órfãos ou concorrentes
não entram no lote. O navegador não decide se o lote terminou. Upload e
confirmação passam por Server Actions: o navegador nunca chama Evolution
e nunca decide o próximo estado da conversa. Um PDF persistido pode ser
reutilizado após falha do envio; `batchId`, `batchDocumentIds` e `commandId`
permanecem estáveis durante a mesma tentativa lógica. A atribuição automática ao atendente que enviou a
primeira proposta é uma regra da Tenant API. O histórico é separado por
conversa e solicitação, não por telefone, e o detalhe autoritativo fornece a
lista completa de PDFs. A sidebar consulta a contagem autoritativa e exibe o
badge numérico no item único Orçamentos. A tela atualiza a fila a cada cinco segundos, ao
retomar o foco e por ação manual, removendo o item somente depois que a Tenant
API publicar a confirmação assíncrona de todos os membros do lote. O painel de
conversa traduz essa confirmação para `Proposta enviada` e `Aguardando cliente`,
sem continuar exibindo `Aguardando proposta`.

Todo funcionário recebe as permissões implícitas de autoatendimento publicadas
pela Tenant API. O dashboard limita os dados às filas atribuídas ao usuário. O
sino de notificações fica no header para todo usuário ativo, sem depender de
departamento ou permissão de módulo. `GET /notifications` deriva os
departamentos do JWT e retorna somente itens compatíveis; no Comercial isso
inclui novos orçamentos pendentes. A inspeção complementar de automações
pausadas só ocorre quando o usuário também possui
`whatsapp-conversations:manage`. O badge representa apenas itens ainda não
visualizados pelo usuário. `GET /notifications` publica `unreadCount`,
`read` e `unreadTotal`; abrir o Drawer zera o badge de forma otimista e chama
`POST /notifications/:notificationId/read`. A leitura fica persistida por
usuário na Tenant API, sem remover a pendência da lista. O armazenamento local
é usado para notificações da API somente quando essa confirmação falha. Novos
ciclos pendentes voltam a ser não lidos. Automações pausadas, ainda derivadas
da projeção do painel, mantêm leitura local por identificador.

## Lume Routing Core

A rota `/routing` é apenas a interface do núcleo. Ela coleta os dados do MVP e
usa uma Server Action para chamar o gateway autenticado; regras determinísticas
permanecem na Tenant API. O resultado apresenta distância, duração, combustível,
pedágios, custo e uma área reservada para a geometria do mapa.

O cadastro genérico de clientes PF/PJ continua em `/clients`. Contratos,
colaboradores, pontos fixos, rotas sugeridas e downloads do módulo anterior não
fazem parte deste núcleo e suas telas foram removidas. Um futuro consumidor de
fretamento contínuo deverá chamar o mesmo endpoint, sem inserir lógica no React.

Novas contas são restritas ao modo colaborador. Contas legadas de candidato,
cliente ou portal documental continuam editáveis sem permitir troca do modo de
acesso, até que a Tenant API publique representação e permissões próprias.

## Autenticação e ciclo da conta

O login só aceita uma resposta de sessão completa. A senha inicial de
provisionamento não abre sessão; a Tenant API responde
`ACCOUNT_PASSWORD_SETUP_REQUIRED` depois de validar a credencial e o frontend
orienta contato com o administrador. O formato legado
`passwordChangeRequired` é tratado como resposta incompatível e nunca é
convertido em sessão ou formulário inline.

**Esqueci minha senha** direciona para `/forgot-password`. A Server Action
valida e normaliza o identificador, chama `POST /auth/password/forgot` e
apresenta a mesma confirmação independentemente de a conta existir. O token
entregue por e-mail abre `/reset-password?token=...`; somente essa rota renderiza
o formulário que consome `POST /auth/password/change`.

O contrato técnico atual usa os estados `active`, `inactive` e `suspended`; isso
não transforma `inactive` em termo de negócio nem substitui o futuro estado do
vínculo de trabalho. A suspensão exige
motivo e prazo em quantidade de dias ou data final. A Tenant API bloqueia novas
autenticações e sessões existentes. `users:update` autoriza edição e recuperação
de senha; a API atual só aplica departamentos e permissões enviados por
administrador ou TI. Depois de uma tentativa de edição de acesso, o frontend
compara esses campos na resposta autoritativa e sinaliza conflito em vez de
mostrar sucesso quando a API os descarta. `users:manage` atua no estado da conta, permitindo
reativar, desativar ou suspender. Não existe `users:delete` no catálogo: o
endpoint `DELETE /users/:id` usa `users:manage`, mas o caso de uso exige
administrador, senha atual e um alvo diferente da própria conta. O controle de
exclusão lógica aparece somente para administrador.

Consulte [tenant-api-integration.md](tenant-api-integration.md) para os
endpoints já integrados e [tenant-api-contract-gaps.md](tenant-api-contract-gaps.md)
para as decisões aprovadas que ainda não possuem contrato consumível.
