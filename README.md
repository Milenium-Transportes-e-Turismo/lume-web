# Lume Tenant Web

O fluxo de checklists, upload, revisão humana e candidatos restritos está em
[`docs/document-management.md`](docs/document-management.md).
Decisões aprovadas que ainda dependem de contrato da Tenant API estão separadas
em [`docs/tenant-api-contract-gaps.md`](docs/tenant-api-contract-gaps.md).

Os tokens, decisões de componentes e regras de acessibilidade do design system
Lume estão em [`docs/design-system.md`](docs/design-system.md).

Aplicação operacional instalada por cliente. Ela se comunica somente com o
`lume-tenant-api` da mesma instalação e continua funcional sem acesso ao
`lume-control`.

> **Estado atual:** MVP em validação local. Nenhuma das mudanças descritas
> neste documento foi publicada em produção.

## Para que serve

Este é o painel usado pelos colaboradores da empresa. Em linguagem prática, ele
permite entrar com segurança, visualizar apenas as áreas autorizadas, acompanhar
notificações, atender clientes pelo WhatsApp, preparar e enviar orçamentos,
administrar usuários e abrir solicitações de suporte.

O painel não envia mensagens nem altera o banco sozinho. Todas as operações
passam pela Tenant API, que valida o usuário, a empresa, as permissões e o estado
mais recente antes de aceitar uma ação.

## Responsabilidades

- login, recuperação de senha e sessão dos colaboradores do tenant;
- dashboard e navegação baseada na interseção entre departamentos e permissões devolvidas pela API;
- administração local de usuários, departamentos, permissões individuais e estados de acesso;
- consulta da licença local;
- módulos operacionais, como agentes de IA e o Painel WhatsApp.

O frontend não cria usuários por meio do plano de controle e não se comunica
diretamente com automações externas ou `lume-edge-agent`.

A permissão autoriza a operação e a área limita o escopo dos dados. Enquanto o
contrato configurável não é publicado, o cadastro de colaboradores usa um
espelho local do catálogo estático atualmente publicado pela Tenant API — Comercial, Compras, Controladoria,
Departamento Pessoal, Financeiro, Gerência, Manutenção, Monitoramento,
Operacional e Tecnologia da Informação — e oferece somente permissões
compatíveis. Códigos técnicos não são exibidos aos atendentes. Os gates
organizacionais legados ainda existentes estão registrados como lacuna de
contrato, não como regra definitiva do produto.

Contas administradoras não podem ser criadas, promovidas, rebaixadas ou
transferidas pelo Tenant Web. O cadastro sempre cria um usuário padrão com
departamentos e permissões explícitas; uma conta administradora já
provisionada aparece apenas como informação de leitura.

Novas contas de candidato (`document-portal`) e cliente (`client`) estão
bloqueadas no formulário, no schema e nas Server Actions. Candidatos aguardam o
contrato de link seguro; clientes aguardam a Área do Cliente. Contas legadas
continuam legíveis e editáveis, mas o modo de acesso é somente leitura e não
pode ser convertido pelo frontend.

`/users` exige ao menos uma permissão entre `users:view`, `users:create`,
`users:update` e `users:manage`; os limites por papel e alvo continuam aplicados
pela Tenant API. `/license` exige vínculo com Gerência e `license:view`. A
sidebar separa módulos em **Geral**, **Cadastros**, **Comercial**, **Pessoas** e
**Administração**; Painel WhatsApp e Orçamentos são exclusivos do escopo
Comercial. **Orçamentos** é um único item
de navegação e abre `/quote-proposals`, onde as filas **Pendentes**, **Enviadas**,
**Aprovadas** e **Canceladas** aparecem como abas. A contagem pendente é
autoritativa da Tenant API. Os gráficos e motivos de cancelamento ficam no
Dashboard Comercial.

O botão **Esqueci minha senha** abre o fluxo público e não revela se o
identificador informado existe. A senha inicial criada durante o
provisionamento não autentica nem cria sessão: após a credencial inicial ser
validada, um Dialog solicita a senha definitiva e retorna automaticamente ao
login. O e-mail via Resend fica reservado à recuperação solicitada por
**Esqueci minha senha** ou pelo administrador.

Falhas de login, recuperação e redefinição exibem uma mensagem legível e
`Código do erro: <CODE>`. O código estável deve ser informado ao suporte; códigos
retornados pela Tenant API são preservados e falhas locais possuem fallbacks
determinísticos para validação, timeout, indisponibilidade e limite de tentativas.
Usuários e perfil seguem o mesmo contrato, inclusive para `HTTP_413`.

## Execução

```powershell
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

Por padrão, a API local é `http://localhost:3333/api/v1`. Em produção,
`LUME_TENANT_API_URL` deve usar HTTPS. A autenticação simulada nunca é aceita
quando `NODE_ENV=production`.

Para homologação na VPS, use `.env.staging.example` e siga o canário, a troca
controlada e o rollback descritos em
[Ambientes e branches](docs/deployment-environments.md). A VPS consome somente
`origin/staging`; branches de trabalho e alterações sem commit nunca chegam ao
ambiente.

Os endpoints consumidos, o fluxo de renovação e os limites atuais do backend
estão documentados em [docs/tenant-api-integration.md](docs/tenant-api-integration.md).
O empacotamento, as sondas e o procedimento de publicação/rollback estão em
[docs/production.md](docs/production.md).

O Painel WhatsApp usa somente a Lume Tenant API, com histórico real, comandos
versionados, resposta do atendente idempotente e polling server-side com
backoff. A caixa de entrada consulta uma página por vez e envia pesquisa e
filtros ao servidor; os indicadores agregados chegam no mesmo contrato. Assim,
uma importação com milhares de conversas não dispara uma requisição por página
nem excede o limite de chamadas da API. O detalhe compacto exibe canal e
responsável no cabeçalho; quando a
conversa está encerrada, projeta ali o atendente que executou o encerramento. Separa as
ações operacionais em duas colunas e abre encaminhamento, status comercial,
histórico de ações e orçamentos em modais. O botão **Abrir chat** abre o painel
lateral construído com o componente `Message` do shadcn/ui para leitura do
histórico completo, anexos e envio de texto ou arquivo pelo atendente. As
mensagens anteriores são carregadas progressivamente quando o usuário chega ao
início da lista, preservando a posição de leitura. No desktop, esse painel pode
usar até 84 rem de largura — aproximadamente o dobro da largura anterior — e,
no celular, ocupa a largura disponível sem criar rolagem horizontal.
O chat apresenta imagens e figurinhas, reproduz áudio e vídeo e oferece a
abertura de documentos quando a Evolution fornece uma URL HTTPS válida. Esses
conteúdos permanecem no histórico, mas nunca são enviados à IA para leitura.
O header autenticado também concentra o sino para todos os usuários ativos; a Tenant API
retorna somente notificações compatíveis com seus departamentos. Não há
integração direta do navegador com cache ou Evolution.

Usuários com permissão de gerenciamento podem abrir **Importar históricos** no
Painel WhatsApp, selecionar vários backups ZIP, acompanhar falhas por arquivo,
revisar telefone, participante, departamento e estado e aplicar uma única
planilha consolidada. Anexos contidos nos ZIPs ficam acessíveis nas respectivas
mensagens; somente referências realmente ausentes são marcadas como
indisponíveis. A gravação continua sob responsabilidade do importador oficial
da Tenant API.

A mesma tela aceita `msgstore.db.crypt15` para importar em lote o backup
Android completo. A chave de 64 caracteres é encaminhada apenas à Tenant API e
apagada do formulário assim que o arquivo é validado. A aplicação acompanha o
processamento assíncrono por blocos. Antes da confirmação, a tela separa
mensagens já existentes, novas e divergentes e também mídias já armazenadas,
novas e ainda ausentes. Repetir o mesmo backup não duplica o histórico; um
backup posterior acrescenta somente mensagens novas e pode completar mídias
pendentes de importações anteriores. O ZIP de mídias é enviado em blocos
retomáveis e vinculado em segundo plano, com progresso persistente na tela; o
navegador não precisa manter o arquivo inteiro em memória.

**Encerrar atendimento** termina somente o controle humano por meio do comando
versionado `actions/return-to-bot`. A interface e a Server Action permitem essa
ação somente ao atendente atualmente responsável, dentro do escopo Comercial;
a Tenant API repete essa verificação dentro da transação versionada. A exceção
de supervisão para Gerência e Diretoria foi aprovada com permissão explícita,
motivo obrigatório e auditoria de pessoa e data/hora, mas continua desabilitada
até a Tenant API publicar esse contrato. O Web não a infere de `management` nem
de `isAdministrator`.

`actions/close` permanece um comando distinto que move a conversa canônica para
o estado técnico temporário `closed`. Ele não encerra nem elimina a conversa em
definitivo: o próximo contato reabre o mesmo histórico. A rota não é exposta
pela interface nem por uma Server Action como sinônimo de encerrar o atendimento
humano; `close-after-rejection` permanece apenas como alias legado no gateway e
na leitura do histórico.

O atendente responsável pode alterar o status comercial no Painel WhatsApp.
A ação recarrega a conversa autoritativa, exige motivo para recusa ou
cancelamento e respeita a versão devolvida pela Tenant API. A criação de um
orçamento também parte exclusivamente da conversa comercial já assumida; as
a página de Orçamentos mantém as filas Pendentes, Enviadas, Aprovadas e
Canceladas em abas.

Na administração de usuários, `users:update` autoriza edição e recuperação de
senha, mas o contrato atual da Tenant API ainda aplica departamentos e
permissões somente quando o ator é administrador ou TI. `users:manage` autoriza
o ciclo de estado da conta (ativar novamente, desativar ou suspender). Não há a
permissão `users:delete`: a exclusão lógica usa `DELETE /users/:id`, exige
`users:manage` no endpoint e ainda é recusada pelo caso de uso para qualquer ator
que não seja administrador com senha confirmada. Por isso, somente um
administrador vê esse controle no Tenant Web. Quando uma edição solicita mudança
de acesso, o frontend confere departamentos, permissões e vínculo devolvidos pela
API e não apresenta sucesso se o estado autoritativo não confirmar a alteração.

## Configuração passo a passo

1. Copie `.env.example` para `.env.local`.
2. Informe a URL da Tenant API desta instalação.
3. Gere um `SESSION_SECRET` exclusivo com pelo menos 32 bytes.
4. Mantenha simulação e mocks desabilitados, exceto em teste local intencional.
5. Ajuste apenas o nome público do cliente e do produto; marca, logotipo e cores
   são definidos pelo design system Lume.
6. Instale as dependências e execute `npm.cmd run dev`.

Os exemplos de ambiente são organizados por finalidade e informam o que é
obrigatório, opcional, público ou secreto. Valores `NEXT_PUBLIC_*` chegam ao
navegador e nunca podem conter chaves, tokens, senhas ou licenças.

## O que reutilizar em novas telas

- `AuthenticatedShell` e o catálogo de navegação para manter sidebar, header,
  permissões e tema consistentes;
- `CurrentUserAvatar` para fotos do usuário atual;
- `ConversationMessageSheet` para histórico, anexos, takeover e envio pelo
  atendente;
- os repositórios `LumeApi*` e as Server Actions existentes para que o browser
  nunca receba credenciais da API;
- os componentes base de `src/shared/ui`, sem copiá-los nem alterá-los;
- o tratamento compartilhado de erros públicos para sempre informar um código
  útil ao suporte.

Novas interfaces genéricas de importação e exportação devem receber da Tenant
API um contrato de lote, progresso, erros por registro e download. A integração
local de compatibilidade já existente é o módulo de roteirização descrito
abaixo. Conversão de documentos e planilhas continua proibida no navegador.

## Roteirização legada orientada por contrato

O módulo atual `/routing` é uma integração local de compatibilidade, ainda não
publicada como modelo canônico de Viagens e Planos de Rota. Até a Tenant API
resolver [GAP-TRIP-01](docs/tenant-api-contract-gaps.md), ele segue cliente,
contrato, importação da lista geral
de colaboradores, sugestão automática, revisão, aprovação e publicação. Não há
cadastro manual de rota-base. O modelo oficial e a importação usam XLSX; versões
aprovadas podem ser exportadas em PDF e XLSX operacional ou XLSX/CSV para Google
My Maps. Centro de custo pertence ao contrato e ao relatório operacional, mas é
intencionalmente omitido dos arquivos do My Maps.

Novas contas são somente de colaborador. Os modos candidato e cliente aparecem
apenas em contas legadas e não podem ser escolhidos nem convertidos. Funcionários
internos com `passengers:import` selecionam o cliente na tela antes de baixar o
modelo ou importar XLSX, CSV ou TSV; CPF/CNPJ não é repetido em cada linha.

Em `/routing/companies`, o cadastro e as consultas são separados nas abas
**Cadastrar cliente**, **Em operação** e **Desativados**. Um cliente ativo deve
ser desativado para preservar o histórico antes que a opção progressiva de
exclusão definitiva, protegida pela senha atual, seja exibida.

## Qualidade

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run build
git diff --check
```
