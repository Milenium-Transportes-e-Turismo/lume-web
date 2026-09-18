# Lume Tenant Web

## PR: navegação e favoritos

### Alterado

- Navegação autenticada reorganizada por departamentos.
- Rotas de Operação, Roteirização, Comercial e Financeiro.
- Compatibilidade da rota `/routing`.
- Configuração de sessão e `LUME_TENANT_API_URL`.

### Adicionado

- Catálogo e árvore de navegação.
- Painel de departamentos.
- Ações de favoritos integradas à API.
- Testes de navegação e autenticação.

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
