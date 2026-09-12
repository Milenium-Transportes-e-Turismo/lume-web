# Transportes

Os CNPJs das empresas do tenant possuem identidade e dados próprios, independentes do Cadastro de clientes e funcionários. Pessoas físicas e jurídicas atendidas continuam no Cadastro. A frota, o cliente e o funcionário podem ter empresas diferentes, registradas no Lume por vigência.

## Operação

1. Cadastre as empresas em **CNPJs do tenant**, com razão social e nome fantasia. A inativação mantém referências e histórico.
2. Em **Tipos e categorias**, adicione os tipos iniciais e amplie o catálogo conforme a operação.
3. Cadastre a **Frota**, escolhendo o nome fantasia da empresa. O número da frota é a identificação operacional. Origem e ID externo não são solicitados neste formulário. O mapeamento técnico da integração depende da confirmação dos campos da Avic; não é deduzido do número da frota.
4. Em **Vínculos**, selecione pessoas PF/PJ do Cadastro existente e a empresa prestadora. Encerre o vínculo anterior antes de cadastrar a nova vigência.
5. Cadastre **Contratos** por cliente e empresa, definindo modalidade e vigência. No detalhe, adicione condições diárias ou mensais. A franquia é opcional e pode existir condição específica de transição mensal.
6. Associe **Rotas de origem** aos contratos por vigência. Confirme o significado dos identificadores externos; nomes ajudam na revisão, não provam identidade.
7. Configure os requisitos da **Integração Avic** e solicite importações por ID de veículo confirmado na Avic e período. **Importação e análise** mostra filas e retomada de importações com falha.
8. Solicite análise dos dados importados independentemente da importação. **Pendências** mostra o contexto e histórico. Corrija KM exclusivamente na Avic; registre justificativa no Lume quando necessário.
9. Use **KM por contrato** para comparação autoritativa. O estado do período é explícito. Fechar/reabrir apenas controla a conferência, sem cobrança ou operação financeira.

## Permissões

- Empresas e vínculos: clients:view/create/update/manage.
- Frota e tipos: trips:view/create/update/manage.
- Contratos e rotas: contracts:view/create/update/manage.
- Leitura de importações, análise, registros, pendências e configuração: trips:view ou trips:manage.
- Solicitação de importações/análises, justificativas, configuração e estado do período: trips:manage.
- Inativação de empresa: clients:update/manage e vínculo com Gerência ou Diretoria; a API confirma a regra.

A navegação aceita as permissões publicadas pela API sem impor uma lista fechada de códigos. Operações indevidas permanecem bloqueadas na API. As listagens usam páginas de 25 registros e busca no servidor.

## Conferência e histórico

Valores Avic são registros do motorista, não medição independente da execução. A Web nunca altera odômetro, deduz culpa ou resolve pendências manualmente. Falha de reconsulta significa verificação pendente/indisponível; a justificativa não confirma a correção. A API decide resolução depois de importar e analisar a origem novamente.

O detalhe mostra eventos disponíveis com detecção, verificação, justificativas e valores antes/depois. Autor de alteração Avic não é inferido. Comandos de justificativa mantêm o mesmo ID em retentativa sem mudança de texto e usam a versão autoritativa; conflitos recarregam o detalhe e preservam o texto.

A franquia ausente não é zero. O contrato mensal não recebe meta diária proporcional. A interface exibe dados insuficientes e diferença indisponível conforme a API; não calcula valores de cobrança ou lucro.

## Ativação e validação

A integração real exige configuração da API e confirmação do identificador estável e do fuso da origem, além de vínculo dos veículos. Não há credencial Avic no Web. Autenticação da documentação Swagger não comprova autorização da API de dados.

A implementação atual está nos diretórios existentes lume-tenant-api e lume-tenant-web da VPS, na branch develop. Os testes de banco usam PostgreSQL descartável. Produção, serviços ativos e bancos compartilhados não fazem parte da validação deste conjunto. Build/testes de código não comprovam comunicação real com a Avic, rotina diária em serviço ou funcionamento de produção.

## Evidências históricas da entrega inicial na VPS

- Build Next.js/Turbopack, TypeScript e lint integral concluídos.
- Os 23 testes de Transportes passaram, incluindo preservação de IDs grandes e nulos, limitação das operações de escrita, justificativa idempotente e recarga autoritativa após conflito.
- O gateway validou 18 projeções JSON reais produzidas pelos testes da API com PostgreSQL descartável: cadastros, contratos, rotas, importações, registros, pendências, configuração, análise e resumo.
- A suíte integral executou 973 testes. Duas expectativas antigas de navegação foram atualizadas para incluir Transportes; três suítes foram reexecutadas, incluindo um teste legado de IA sensível ao limite de 5 segundos, com 40 testes aprovados e limite de 20 segundos.
- A formatação dos arquivos alterados passou. A verificação global também abrange 72 arquivos preexistentes fora deste escopo com divergências de estilo, principalmente skills em .agents e dois arquivos legados não alterados.

Essas verificações não equivalem a teste com credenciais reais da Avic ou deploy no ambiente ativo.

## Login automático Avic

O login e a renovação de acesso pertencem à Tenant API. O operador configura usuário
(UserID) e chave (AccessKey) no ambiente privado da API; não precisa copiar tokens
para executar a importação diária. A Web não recebe nem armazena esses segredos.
A API renova por nova autenticação com senha, pois o procedimento de refresh não foi
documentado pela Avic. Alterações de ambiente entram em vigor após implantação autorizada.

## Navegação e perfil do cadastro — 10/09/2026

CNPJs do tenant fica em Empresa > Dados, em /companies.
Frota (/fleet) e Tipos e categorias (/catalogs) ficam em Empresa > Frota.
No perfil /registrations/[registrationId], as abas Vínculos com empresas e
Contratos exibem apenas os registros daquele cadastro. A pessoa/cliente é
preenchida pelo contexto do perfil, inclusive ao reutilizar um contrato
existente; busca, totais e paginação são filtrados pela API.

A aba Relacionamentos continua representando relações entre cadastros. Os
vínculos com empresas prestadoras preservam papel, vigência e histórico.
Registros mantém pendências, registros importados, importação/análise, rotas de
origem e KM por contrato. A configuração Avic fica em /integrations/avic.
Permissões de leitura e escrita continuam as mesmas. A separação dos CNPJs exige
a migração 20260910000100_tenant_legal_entities. O worker Avic inicia desativado
por padrão; confirme seu valor efetivo na API antes de esperar execuções.

## Navegação e formulário simplificado — revisão de 10/09/2026

A árvore da sidebar agora organiza CNPJs em Empresa > Dados, a configuração Avic em Empresa > Dados > Integrações e veículos e catálogos em Empresa > Frota. Vínculos e contratos permanecem nos perfis do Cadastro. A operação anteriormente chamada Transportes passa a Registros em Financeiro > Controle; sua rota continua /transport. Os atalhos dos catálogos filtram o tipo correspondente.

Os seletores de Frota carregam todas as páginas disponíveis, sem caixas de pesquisa nem controles de paginação no formulário. O código dos tipos e categorias é numérico, gerado pela API/banco e somente apresentado para consulta. A migração preserva IDs, referências e o código anterior no histórico interno.

A configuração da Avic distingue o identificador único da viagem da identificação do veículo por frota. A franquia de KM pertence às condições do contrato. O antigo limite global de distância deixa de ser solicitado e é limpo ao salvar a configuração. O limite técnico restante compara o odômetro final da viagem anterior com o inicial da seguinte; indica uma diferença para conferência, não uma infração contratual nem culpa do motorista.

## Seleção de empresa

Nos formulários de contratos e vínculos, a empresa prestadora é escolhida diretamente no select, como na Frota. A lista carrega todas as páginas pela API e preserva a empresa já selecionada ao editar. Não há campo de pesquisa nem paginação visível para esse seletor.

O fuso dos horários da Avic recebe o deslocamento UTC confirmado na origem, com sinal e números (por exemplo, -03:00). O exemplo é apenas placeholder e nunca preenche a configuração automaticamente. Sem confirmação, o campo pode ficar vazio e os requisitos de ativação continuam pendentes. O formulário impede o envio de valores como +HH:MM e mostra orientação em português; editar o campo remove o erro de validação para permitir nova tentativa. A API mantém a validação autoritativa.

## Quando Registros importados está vazio

A rota `/transport?tab=records` mostra somente dados persistidos. **Filtrar / atualizar**
não importa viagens. Verifique período e ID externo do veículo, depois o estado do
job em **Importação e análise**. Integração habilitada no painel não comprova worker
ativo, vínculo de veículo nem importação concluída. A rotina diária requer frota
ativa com vínculo Avic confirmado; o formulário não cria esse mapeamento sozinho.

Na configuração, **Identificador único da viagem na Avic** recebe o nome confirmado
do campo, como `RegistroViagemId` ou `Id`, e não um valor como `2031` nem o número
da frota. A API aceita texto nesse campo; preenchimento e readiness não comprovam
que o campo existe na resposta real. Os segredos, a consulta e o processamento
continuam exclusivos da API.
