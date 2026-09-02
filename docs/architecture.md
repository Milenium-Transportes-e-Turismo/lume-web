# Arquitetura do Lume Tenant Web

Gestão documental usa o shell existente e um gateway server-only. O modo
`document-portal` reduz a navegação a **Meus documentos**; a Tenant API continua
autoritativa para isolamento, revisão e download.

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

O departamento é o limite estrutural de navegação e dados; permissões
individuais, no formato `recurso:ação`, refinam o que o usuário pode fazer
dentro desse limite. O formulário de criação segue três etapas: dados básicos,
seleção de um ou mais departamentos e seleção das permissões compatíveis
publicadas por `GET /permissions`. Permissões implícitas permanecem sob
autoridade da Tenant API e não podem ser removidas pelo navegador.

O catálogo público possui exatamente Comercial, Compras, Controladoria,
Departamento Pessoal, Financeiro, Gerência, Manutenção, Monitoramento e
Operacional. Registros legados continuam legíveis para compatibilidade, sempre
traduzidos para um rótulo humano, mas não voltam às opções de cadastro nem aos
filtros e encaminhamentos do Painel WhatsApp.

`/users` exige departamento Gerência e ao menos uma permissão entre
`users:view`, `users:create`, `users:update` e `users:manage`;
`/license` exige o mesmo departamento e `license:view`. Painel WhatsApp e
Orçamentos exigem departamento Comercial e a permissão do módulo.

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

- **Geral:** Dashboard, Agentes de IA e Suporte, sujeitos às respectivas
  permissões e com conteúdo filtrado pelo departamento;
- **Cadastros:** clientes PF/PJ usados por toda a aplicação;
- **Comercial:** Painel WhatsApp e Orçamentos, somente para vínculo Comercial;
- **Operacional:** cálculo de roteirização e custos, conforme as permissões
  `route-planner:view` e `route-planner:calculate`;
- **Pessoas:** Usuários e Gestão documental conforme vínculo e permissões;
- **Administração:** Painel administrativo exclusivo de administradores, além de
  Usuários e Licença conforme as permissões e o vínculo organizacional. O painel
  apresenta volume, bytes, duração, resultados, usuários e ações humanizadas;
  nunca exibe rotas ou conteúdo das requisições.
  permissão individual correspondente.

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
dimensões canônicas em uma grade compacta. Assumir, devolver e encerrar ficam
na coluna operacional; Abrir chat, Encaminhar e Alterar status ficam na coluna
de apoio. Encaminhamento, status, lista de orçamentos e histórico de ações são
modais, evitando que formulários e históricos imponham rolagem permanente à
página. O botão Assumir fica desabilitado assim que houver responsável; a
devolução ao bot usa exclusivamente o comando versionado da Tenant API.

Mensagens enviadas pelo atendente usam `commandId` e `idempotencyKey` estáveis
enquanto o rascunho não for confirmado. A Tenant API persiste a mensagem em
`pending` e publica o processamento assíncrono; o frontend apenas acompanha o
resultado pelo histórico versionado.

O encerramento também é um comando versionado da Tenant API. Durante o MVP,
uma proposta já aprovada não bloqueia o encerramento manual. A antiga política
permanece documentada na constante
`BLOCK_APPROVED_QUOTE_CONVERSATION_CLOSE=false`, permitindo reativação futura
sem apagar a decisão anterior. Propostas ainda em coleta, aguardando o cliente
ou em análise continuam bloqueando a ação. A Tenant API é a autoridade final:
uma resposta de erro não é convertida em sucesso pelo frontend. Uma conversa
com proposta aprovada, sem atendente e em `waiting-for-customer` também pode ser
devolvida ao bot para o menu de acompanhamento. Quando a solicitação foi
recusada, o motivo efetivo é obrigatório. O painel apresenta o histórico de
encerramento com data e hora, atendente responsável e motivo, sem expor o log
técnico completo de transições. A permissão de gerenciamento do Comercial
autoriza o mesmo encerramento versionado em conversas encaminhadas a outros
departamentos; o frontend não impõe um filtro departamental adicional.

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

Contas usam os estados `active`, `inactive` e `suspended`. A suspensão exige
motivo e prazo em quantidade de dias ou data final. A Tenant API bloqueia novas
autenticações e sessões existentes. `users:update` edita dados, departamentos,
permissões e recuperação de senha; `users:manage` atua somente no estado da
conta, permitindo reativar, desativar ou suspender. `users:delete` não existe no
catálogo nem na interface.

Consulte [tenant-api-integration.md](tenant-api-integration.md) para os
endpoints já integrados, o ciclo de renovação da sessão e as pendências de
contrato da API.
