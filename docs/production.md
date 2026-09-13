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
- `MAP_STYLE_URL` é uma configuração legada; não controla o mapa Leaflet atual.

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
destinos HTTPS dos anexos publicados por ela. O navegador acessa os tiles do mapa Leaflet e os recursos públicos usados pela
interface; uma CSP deve permitir apenas os hosts efetivamente utilizados.

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
8. Valide separadamente **Encerrar conversa**, **Retornar à IA** e **Transferir**
   pelos comandos nativos versionados da sessão. Confirme que o painel respeita
   `availableActions` e que ator sem capacidade/escopo não altera o estado.
   Conflitos devem exigir recarga; não simular sucesso. A confirmação de resumo
   deve criar o orçamento e colocar a sessão na fila humana do Comercial.
   Novo pedido durante controle humano deve gerar sugestão privada, sem enviar
   resposta automática. Confira preservação do histórico e dos orçamentos anteriores.
9. Verifique o sino em usuários de departamentos diferentes e confirme que cada
   um recebe somente notificações do próprio escopo. No Comercial, valide o
   aviso de novo orçamento pendente.
10. Confirme Empresa, Plataforma, Dashboards, Financeiro, Operacional e Comercial
    na sidebar, conforme as permissões,
    o envio de suporte pelo provedor e, ao simular uma falha autorizada, o
    `mailto:` com identificação do solicitante; confirme também a negativa de
    `/users` sem uma permissão `users:*` compatível e de `/license` fora de
    Gerência ou sem `license:view`.
11. Com um usuário autorizado, confirme **Roteirização** sob **Operacional** e
    execute um cálculo controlado. A requisição deve ir somente para a Tenant
    API e uma base de pedágios indisponível deve aparecer como cobertura parcial,
    sem valores simulados. O mapa deve enquadrar a rota, mostrar origem, destino,
    paradas e pedágios e preservar a atribuição do provedor cartográfico exibida no mapa.
12. Confirme que o cadastro oferece somente conta de colaborador, que payloads
    de criação `client` e `document-portal` são recusados e que contas legadas
    continuam editáveis sem permitir troca do modo de acesso.
13. Direcione tráfego e acompanhe erros 401, 403, 409, 423, 5xx e falhas de
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

O planejador atual usa Leaflet/OpenStreetMap; não depende da configuração legada
de estilo MapLibre.

## Ajustes de interface e atividade administrativa — setembro de 2026

As páginas de conteúdo usam lume-page para espaçamento responsivo consistente. Roteirização e conversas mantêm suas áreas de trabalho próprias. Os seletores de domínio compõem os componentes instalados por meio de shared/form-select; textos extensos quebram linha sem sobrepor a seta.

SelectAllCheckbox é usado em todos os controles de seleção coletiva de departamentos, permissões e documentos. Somente a seleção de todas as opções disponíveis marca o controle; seleção parcial permanece desmarcada e acionável.

Origem, destino e paradas compartilham a busca de cidade, endereço e CEP. Pontos no mapa são identificados pela Tenant API e os rótulos acompanham as coordenadas no cálculo. Respostas antigas são canceladas ao mudar de campo ou limpar o trajeto.

O modal de pareamento consulta o estado autorizado do canal e o QR atual a cada oito segundos, oculta códigos em falhas/expiração e encerra consultas ao fechar. A conexão só é anunciada após confirmação do provedor e sincronização versionada na API.

O painel administrativo reúne auditoria e uso recente em uma lista com paginação cronológica no servidor. O filtro de resultado limita a registros de requisição, pois eventos de auditoria não possuem código HTTP. Não existe correlação presumida entre requisições e comandos distintos.

## Disponibilização da opção de agentes por canal

Atualizar primeiro a Tenant API e aplicar a migration
20260907211000_channel_agents_enabled. Depois atualizar a Web. Não são necessárias
novas variáveis de ambiente. Confirmar a edição versionada do canal e a apresentação
de Agentes de IA habilitados. A atualização preserva a ativação dos canais existentes.

## Atualização de autoria e envio

Disponibilizar a API com actor/source no presenter e depois a Web. Não há novas
variáveis de ambiente. Validar autoria da IA, autoria humana e mensagens
pendentes/falhas. Exibição no painel não comprova entrega ao dispositivo.

## Atendimento contextual e interpretação compacta

O Painel WhatsApp apresenta o atendimento sem menus numéricos. A Tenant API e os
agentes interpretam mensagens novas com o histórico e o orçamento já registrado.
A transferência exige departamento e permite fila e responsável opcionais. Os
seletores mantêm altura uniforme e textos longos truncados.

A interpretação de mídia começa recolhida, abre sob demanda e oferece Fechar.
O texto é exibido uma única vez, priorizando transcrição e texto extraído. Resumo
é usado apenas quando não existe texto. Confiança, JSON, proveniência e contexto
técnico não aparecem na caixa de mensagens; a correção humana continua disponível
para quem possui permissão. Reabrir reutiliza a consulta já concluída; análises
pendentes podem ser atualizadas explicitamente.

A transferência usa o snapshot autorizado anterior ao comando e a sessão retornada
pela API, sem exigir nova leitura do destino. Assim, a perda de acesso ao novo
departamento não transforma um comando confirmado em erro. A lista é atualizada
após a confirmação para refletir o escopo atual do operador.

## Contatos para Google Contacts

A página /contacts consulta os cadastros canônicos ativos e não temporários e
oferece somente exportação CSV compatível com Google Contacts. Importação e
manutenção da agenda deixam esta página; correções são feitas em Cadastro.
A API publica GET/POST /api/v1/registrations/contact-export, com prévia e lotes
de até 3.000 cadastros. Consulta exige clients:view; exportação exige também
documents:view ou documents:manage. Geração, limites e persistência temporária
reutilizam DataExchange. Não requer migration ou novas variáveis; atualizar API
antes do Web. A importação no Google é feita manualmente com o CSV baixado.

## Ativação de Transportes

Transportes não adiciona variáveis públicas nem credenciais ao Web. O serviço continua consumindo apenas LUME_TENANT_API_URL; URL, autenticação Avic e worker pertencem à Tenant API. Configure migrações e serviço em ambiente autorizado antes de publicar uma versão do Web que exiba a área. A tela informa requisitos ausentes, respostas incompatíveis e indisponibilidade, sem simular importação ou correção. A implementação está nos diretórios existentes de desenvolvimento na VPS, na branch develop, e não implica deploy, migração ou validação de produção.

Para login automático Avic, configure AVIC_API_USER_ID e AVIC_API_ACCESS_KEY somente
na Tenant API. Nenhuma variável adicional é necessária no Web. A obtenção de token e
renovação por novo login ocorrem no servidor, sem ação manual no navegador.

## Sidebar e catálogos — 10/09/2026

A sidebar usa duas colunas: ferramentas (tema, notificações e cor) e navegação hierárquica. O menu do usuário fica no topo, com perfil, documentos, suporte e saída. As permissões continuam vindo do catálogo autorizado; exemplos sem funcionalidade não geram links.

Empresa reúne dados, pessoas com filtros de Papel, frota, tipos/categorias, agentes e canais. Plataforma mantém usuários/administração/licença. Registros fica em Financeiro → Controle e conserva /transport, com atalhos por aba. Integração Avic fica em /integrations/avic. Dashboards mostra o painel já existente, sem inventar métricas ou telas departamentais.

A Frota mantém seus seletores e carrega todas as páginas de opções sem controles de busca/paginação em cada campo. Origem e ID externo ficam fora do formulário; referências anteriores são preservadas e não se presume que número de frota seja VeiculoId.

Códigos de tipos/categorias são gerados pela API. O usuário informa tipo e nome; o código numérico é somente leitura. A atualização da API e a migração numeric_catalog_codes devem preceder a Web.

## Compatibilidade com a API e publicação no Git

As telas de Transportes dependem das migrações de catálogos, CNPJs próprios e
códigos numéricos na API. A assistência do WhatsApp depende dos comandos de sessão
e da janela persistida de espera do cliente. Publique a API compatível antes da
Web e consulte o guia de implantação do repositório da API para a sequência de
migrações. Publicar a branch `develop` no GitHub não constitui deploy de serviço.

O desenvolvimento de staging usa os diretórios oficiais
`/home/taiane/lume/lume-staging/lume-tenant-web` e
`/home/taiane/lume/lume-staging/lume-tenant-api`. Compare a revisão construída com
a imagem executada e confirme readiness e comportamento autenticado. Arquivos
`.env`, credenciais, mídias e diagnósticos privados ficam fora do Git.

Preparação da promoção atual: [develop para main](release-develop-main.md).
