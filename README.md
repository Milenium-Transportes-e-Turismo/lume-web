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

### Arquivos e responsabilidades

- `src/features/navigation/authenticated-navigation.tsx`: monta a navegação a partir da sessão atual.
- `src/features/navigation/department-panel.tsx`: renderiza as opções do departamento selecionado.
- `src/features/navigation/navigation-catalog.ts`: centraliza grupos, rótulos, ícones, rotas e regras de visibilidade.
- `src/features/navigation/authenticated-shell.tsx`: fornece a estrutura comum das telas autenticadas.
- `src/shared/app-sidebar.tsx`: mantém o menu lateral e integra a navegação ao layout principal.
- Páginas em `src/app/comercial`, `src/app/operacao`, `src/app/financeiro`, `src/app/routing` e áreas relacionadas: consomem o padrão de departamento.
- Testes da feature de navigation: cobrem usuário autenticado, rotas visíveis, redirecionamentos e favoritos.

### Contrato com a API

O Web usa a mesma `navigationKey` para renderizar o item e para solicitar sua inclusão ou remoção como favorito. Assim, o frontend não mantém uma segunda identificação para o mesmo menu. Se a API negar a operação, o Web não deve considerar o item salvo.

O endereço da API vem de `LUME_TENANT_API_URL`. Em sandbox ele aponta para a API do SBX; em produção deve apontar para o endpoint de produção. Essa variável precisa ser conferida no build e no container antes da promoção.

### Escopo e limites

Esta PR reorganiza a navegação e adiciona favoritos. Ela não substitui as verificações de autorização do backend, não altera o modelo de permissões e não muda o conteúdo funcional das telas de negócio. Rotas antigas continuam disponíveis quando necessárias por compatibilidade.

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
5. Conferir a variável `LUME_TENANT_API_URL` no build da imagem.
6. Promover Web junto com API após a migration.
