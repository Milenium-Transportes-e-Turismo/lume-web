# Lume Tenant Web

O fluxo de checklists, upload, revisão humana e candidatos restritos está em
[`docs/document-management.md`](docs/document-management.md).

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

O departamento define o escopo estrutural de páginas e filas; a permissão
individual limita as operações disponíveis dentro desse escopo. O cadastro de
usuários seleciona um ou mais dos nove departamentos do MVP — Comercial,
Compras, Controladoria, Departamento Pessoal, Financeiro, Gerência, Manutenção,
Monitoramento e Operacional — e, em seguida, somente permissões compatíveis com
esses vínculos. Códigos técnicos de departamento, estado ou permissão não são
exibidos aos atendentes.

Contas administradoras não podem ser criadas, promovidas, rebaixadas ou
transferidas pelo Tenant Web. O cadastro sempre cria um usuário padrão com
departamentos e permissões explícitas; uma conta administradora já
provisionada aparece apenas como informação de leitura.

As rotas `/users` e `/license` exigem vínculo com o departamento Gerência e,
respectivamente, `users:view`/`users:manage` ou `license:view`. A sidebar separa
módulos em **Geral**, **Comercial** e **Administração**; Painel WhatsApp e
Orçamentos são exclusivos do escopo Comercial. **Orçamentos** é um único item
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

No MVP, uma proposta aprovada não impede o atendente de encerrar a conversa,
desde que não exista outra proposta em coleta, aguardando cliente ou em análise.
A política mais restritiva foi preservada no domínio, mas está explicitamente
desabilitada para possível reativação futura. A Tenant API permanece
autoritativa: se ela recusar o comando, o painel mostra o erro e não simula o
encerramento. Um usuário Comercial com `whatsapp-conversations:manage` também
pode encerrar, pelo mesmo comando versionado, contatos encaminhados a outra
fila departamental.

O atendente responsável pode alterar o status comercial no Painel WhatsApp.
A ação recarrega a conversa autoritativa, exige motivo para recusa ou
cancelamento e respeita a versão devolvida pela Tenant API. A criação de um
orçamento também parte exclusivamente da conversa comercial já assumida; as
a página de Orçamentos mantém as filas Pendentes, Enviadas, Aprovadas e
Canceladas em abas.

Na administração de usuários, `users:update` representa **Editar acesso** e
permite alterar dados, departamentos, permissões e solicitar recuperação de
senha. `users:manage` representa **Gerenciar acesso** e fica restrito ao ciclo
de estado da conta (ativar novamente, desativar ou suspender). A aplicação não
publica nem renderiza `users:delete`, pois exclusão de usuário não faz parte do
contrato.

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
API um contrato de lote, progresso, erros por registro e download. A exceção já
publicada é o módulo de roteirização descrito abaixo. Conversão de documentos e
planilhas continua proibida no navegador.

## Roteirização e custos rodoviários

`/routing` é a interface do Lume Routing Core. Ela envia origem, destino,
paradas, veículo, data e combustível para a Tenant API e apresenta distância,
duração, geometria, pedágios e custos. A Tenant API resolve endereços pelo Pelias
e calcula rotas pelo OpenRouteService; o navegador não chama a HeiGIT, banco ou
agente de IA diretamente e não executa cálculos de negócio.

O cadastro corporativo de clientes PF/PJ continua em `/clients`. As telas
anteriores de contratos, colaboradores, pontos fixos, sugestões e exportações
foram removidas; o novo núcleo é independente e poderá ser consumido pelos
fluxos eventual e contínuo em etapas posteriores.

## Qualidade

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run build
git diff --check
```
