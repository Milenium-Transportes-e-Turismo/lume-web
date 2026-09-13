# Documentação da Tenant Web

Índice revisado em 12/09/2026 para o código da branch `develop`. Comece pelo
[README do repositório](../README.md), pelos contratos de integração e pelos guias
de operação do domínio. A API é a fonte autoritativa dos dados e das regras.

Guias operacionais descrevem o comportamento atual; ADRs preservam decisões e
checklists/relatos datados preservam evidências do momento da avaliação. Números
de testes, estado de um serviço ou configuração de um tenant em um relato antigo
não comprovam o estado atual. Confirme revisão, migrações e imagem do ambiente.

## Arquitetura, contratos e demais domínios

- [Arquitetura do Lume Tenant Web](architecture.md).
- [Design system Lume](design-system.md).
- [Gestão documental no Tenant Web](document-management.md).
- [Dependências de contrato da Tenant API](tenant-api-contract-gaps.md).
- [Integração com a Lume Tenant API](tenant-api-integration.md).

## Ambientes e operação

- [Ambientes e branches do Tenant Web](deployment-environments.md).
- [Configuração de ambiente](environment-configuration.md).
- [Produção](production.md).

## Transportes e roteirização

- [Transportes](transport.md).

Preparação da promoção atual: [develop para main](release-develop-main.md).
