# Dependências de contrato da Tenant API

Revisão de 12/09/2026 nos diretórios oficiais de staging, branch `develop`. Este
quadro descreve os contratos e limites do código atual; não comprova implantação
em produção. O frontend consome a API e não cria estados, evidências ou permissões
para completar uma lacuna.

## Estados usados

- **Integrado**: a Web já consome a capacidade publicada no contrato da API.
- **Parcial**: há contrato utilizável, mas o processo de produto não está completo.
- **Pendente**: a capacidade indicada ainda não tem contrato completo utilizável.

Esses estados descrevem cobertura funcional. Deploy e validação em um ambiente
precisam de evidência própria, independentemente de um push no GitHub. Os IDs
abaixo são preservados para referência dos levantamentos anteriores.

| ID            | Capacidade                | Estado e limite atual                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-IDENT-01  | Cadastro Principal        | Integrado para PF/PJ, papéis, contatos e relacionamentos. A conciliação não autoriza mesclar identidades pelo navegador; recomendações não viram vínculos confirmados automaticamente. CNPJs próprios do tenant ficam separados do Cadastro.                                                                               |
| GAP-IDENT-02  | Pré-admissão              | Parcial. A API gerencia criação, renovação, revogação e resolução de links sem criar User. O recebimento público de arquivos e o ciclo completo de admissão ainda não estão disponíveis; não criar contas de candidato para contornar essa lacuna.                                                                         |
| GAP-IDENT-03  | Área do Cliente           | Parcial. Contas cliente legadas e consultas com escopo por empresa existem; o portal unificado e a representação genérica de várias empresas continuam pendentes.                                                                                                                                                          |
| GAP-USER-01   | Vínculo e acesso          | Parcial. Cadastro, usuário de acesso e vínculos operacionais são distintos. O ciclo completo de desligamento/recontratação não deve ser inferido de uma alteração simples de active.                                                                                                                                       |
| GAP-USER-02   | Exclusão e retenção       | Pendente para uma política transversal completa de anonimização, exclusão e retenção. Não transformar inativação em exclusão silenciosa de histórico.                                                                                                                                                                      |
| GAP-WA-01     | Caixa multidepartamental  | Integrado. Filas e sessões respeitam escopo e capacidades da API; o painel não é restrito ao Comercial por uma regra fixa da Web.                                                                                                                                                                                          |
| GAP-WA-02     | Transferência             | Integrado no comando nativo de sessão, com destino, motivo, versão e estado autoritativo. A fachada legada também oferece request-transfer/accept-transfer, mantendo a origem até o aceite; não misturar as duas semânticas.                                                                                               |
| GAP-WA-04     | Supervisão do atendimento | Integrado conforme availableActions e capacidades service:*. Assumir, retornar à fila/IA e encerrar são ações distintas. Sugestões privadas exigem decisão explícita e versões atuais; a IA não responde automaticamente durante controle humano.                                                                          |
| GAP-COM-01    | Aceite comercial          | Parcial. A API preserva evidência e compatibilidade do orçamento legado. Proposta com vários itens versionados ainda não é um processo completo; aceite não confirma serviço nem cria viagem automaticamente.                                                                                                              |
| GAP-COM-02    | Confirmação e pré-reserva | Parcial. A API oferece evidências financeira/operacional, exceções e confirmed-services com autorização própria. Pré-reserva e cancelamento pós-confirmação ainda exigem evolução; não derivar confirmação de approved.                                                                                                    |
| GAP-TRIP-01   | Viagens e Planos de Rota  | Parcial. A API cria viagens individuais de contrato contínuo ou Serviço Confirmado; permite selecionar versão aprovada do plano para contínuo. Lote completo, plano eventual e integrações de execução com veículo/motorista, custos e documentos ainda não estão completos.                                               |
| GAP-DOC-01    | Titulares documentais     | Parcial. Solicitações por subjectRegistrationId atendem PF/PJ sem exigir conta, mantendo subjectUserId legado. Associação pessoal autorizada vale em Meus documentos. Titular genérico de veículo/contrato/orçamento/viagem e relações secundárias ainda exigem evolução.                                                  |
| GAP-DOC-02    | Geração e assinatura      | Pendente para geração por modelo, prova de assinatura e Pasta da Viagem completas. A gestão atual trata arquivos recebidos e revisados.                                                                                                                                                                                    |
| GAP-ACCESS-01 | Modelo de acesso          | Parcial. Catálogo de capacidades, escopo e autoridade da API são utilizáveis; CRUD transversal de perfis, delegações, restrições e matriz de aprovação ainda não está completo.                                                                                                                                            |
| GAP-ACCESS-02 | Departamentos             | Parcial. O runtime usa catálogo fechado, com RH e DP separados. Não há criação livre de departamentos pelo frontend.                                                                                                                                                                                                       |
| GAP-ACCESS-03 | Gestão de usuários        | Integrado no contrato atual, com limites autoritativos por ator e campo. A Web permite criação padrão e edição de acesso a administrador/TI; contas legadas document-portal/client continuam legíveis e editáveis sem conversão do modo. Divergência entre alteração pedida e resposta da API deve aparecer como conflito. |

## Sessões, orçamentos e assistência

O painel usa `/api/v1/service/sessions` e `availableActions`, com `commandId` e
`expectedVersion`. Encerrar sessão, devolver à IA e transferir não são sinônimos.
Os comandos legados de conversa continuam compatíveis, mas não definem sozinhos
as ações do painel atual.

A confirmação do resumo encaminha efetivamente à fila humana do Comercial. Novo
orçamento preserva o anterior e reaproveita somente o nome já conhecido do
responsável. Sob controle humano, um novo pedido produz sugestão privada: o
operador aceita a coleta pela Milena ou mantém o atendimento humano. Assunto de
outro departamento pode gerar sugestão de encaminhamento; não há resposta
financeira automática sem fonte.

O lembrete de três horas e o encerramento após mais uma hora são conduzidos pela
API quando ela aguarda dados do cliente, não quando a pendência é do Comercial.
A Web apresenta esse estado e não executa temporizadores de negócio no navegador.

## Referências

- [Integração com a API](tenant-api-integration.md).
- [Gestão documental](document-management.md).
- [Transportes e CNPJs próprios](transport.md).
- No repositório da API: `docs/tenant-web-contract-readiness.md`,
  `docs/commercial-confirmed-services.md`, `docs/whatsapp-human-assistance.md` e
  `docs/domain-implementation-pending.md` detalham contratos e lacunas por domínio.
