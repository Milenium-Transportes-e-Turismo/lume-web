# Lume Tenant Web

## PR: navegação e favoritos

### Alterado

- `AuthenticatedNavigation` passou a organizar a navegação autenticada por departamento.
- As áreas de Operação, Roteirização, Comercial e Financeiro passaram a usar o mesmo padrão de navegação.
- `/routing` continua funcionando como rota compatível para o módulo de roteirização.
- Sessão e `LUME_TENANT_API_URL` foram ajustados para que o Web use a API do ambiente correto.

### Adicionado

- Catálogo compartilhado com grupos, rotas, ícones e regras de visibilidade.
- `DepartmentPanel`: mostra as opções disponíveis do departamento atual.
- `AuthenticatedShell` e `AppSidebar`: reutilizam o layout autenticado nas páginas.
- Ações de favorito na navegação, integradas aos endpoints da API.
- Testes de navegação, autenticação, visibilidade e redirecionamento.

## Evidência atual

- Branch: `feat/gestor-evolution` → `develop`.
- Teste direcionado: 16/16.
- SBX: Web e API responderam 200; banco de produção restaurado separadamente.
- Typecheck local ainda acusa arquivo gerado em `.next/dev/types/validator.ts`; a formatação global possui avisos antigos fora do escopo.
- Ajuste operacional de permissão no Dockerfile foi feito somente no clone do SBX e não faz parte desta PR.

## Checklist antes de produção

1. Confirmar `LUME_TENANT_API_URL` correto.
2. Executar typecheck, testes, lint, build e `git diff --check`.
3. Validar login, navegação, favoritos, erros e responsividade no SBX.
4. Confirmar permissões por tenant e usuário no backend.
5. Promover Web junto com API após a migration.
