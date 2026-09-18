# Lume Tenant Web

## PR: navegação e favoritos

Esta PR reorganiza a experiência após o login para que o usuário encontre os módulos por departamento e possa marcar os acessos mais usados.

### Alterado

- `AuthenticatedNavigation` passou a organizar a navegação autenticada por departamento.
- As áreas de Operação, Roteirização, Comercial e Financeiro passaram a usar o mesmo padrão de navegação.
- `/routing` continua funcionando como rota compatível para o módulo de roteirização.
- Sessão e `LUME_TENANT_API_URL` foram ajustados para que o Web use a API do ambiente correto.
- Páginas sem permissão não aparecem como opções navegáveis e continuam protegidas pelo fluxo de autenticação.

### Adicionado

- Catálogo compartilhado com grupos, rotas, ícones e regras de visibilidade.
- `DepartmentPanel`: mostra as opções disponíveis do departamento atual.
- `AuthenticatedShell` e `AppSidebar`: reutilizam o layout autenticado nas páginas.
- Ações de favorito na navegação, integradas aos endpoints da API.
- Testes de navegação, autenticação, visibilidade e redirecionamento.

### Como os componentes se relacionam

- `AppSidebar` é o contêiner visual persistente da aplicação.
- `AuthenticatedNavigation` monta os itens permitidos para o usuário atual e controla a navegação lateral.
- `DepartmentPanel` apresenta o conteúdo do departamento selecionado, usando o mesmo catálogo de rotas.
- `AuthenticatedShell` fornece o layout comum para as páginas autenticadas.
- As ações de favorito chamam a API e atualizam o estado da navegação sem criar uma regra paralela no frontend.

### Fluxo para o usuário

1. Após o login, a sessão identifica o usuário e suas permissões.
2. O catálogo filtra os departamentos e rotas disponíveis.
3. O usuário abre um departamento ou acessa uma rota compatível.
4. Ao favoritar um item, o Web envia sua chave para `navigation/favorites`.
5. Ao entrar novamente, os favoritos são carregados pela API e exibidos no menu.

O frontend apenas apresenta as opções. A autorização definitiva permanece no backend, evitando que esconder um item no menu seja tratado como controle de segurança.

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
