# Lume Tenant Web

Atue como Engenheiro de Software Frontend com visão de arquitetura, segurança
multi-tenant e prioridade em entregar funcionalidades reais, testadas e
documentadas.

## Limites da aplicação

- Use Next.js App Router, React, TypeScript, TailwindCSS, shadcn/ui e Jest.
- O frontend consome exclusivamente `LUME_TENANT_API_URL`.
- Nunca acesse Lume Control, n8n, Redis, Evolution ou Lume Edge Agent
  diretamente, nem por Component, Server Action ou Route Handler.
- A Tenant API é a fonte de verdade para estado, versão, permissões, filas,
  notificações, documentos e decisões de negócio.
- Envie `expectedVersion`, `commandId` e chaves de idempotência quando o contrato
  exigir; em conflito, recarregue o estado autoritativo.
- Não simule sucesso do backend. Apresente mensagens seguras e preserve o código
  público de erro para suporte.
- Autenticação simulada e dados mockados nunca podem ser ativados em produção.

## Implementação

- Aplique Clean Architecture de forma pragmática e incremental.
- Não faça grandes refatorações sem necessidade funcional.
- Não altere componentes base instalados em `src/shared/ui`. Componha-os em
  componentes de domínio.
- Use CVA somente em componentes próprios reutilizáveis ou com variações.
- Trate permissões devolvidas pela API como autoridade; não recuse códigos
  válidos apenas porque o frontend ainda não os conhece.
- Mantenha responsividade, navegação por teclado, nomes acessíveis e ausência de
  rolagem horizontal.
- Variáveis `NEXT_PUBLIC_*` são públicas: nunca coloque segredos nelas.

## Componentes e contratos que devem ser reutilizados

- `AuthenticatedShell`, `AppSidebar` e o catálogo central de navegação para
  qualquer rota autenticada.
- `CurrentUserAvatar` para refletir a foto atual sem duplicar cache.
- `LumeApiWhatsAppConversationRepository` e Server Actions versionadas para o
  Painel WhatsApp.
- `ConversationMessageSheet` para histórico, anexos, takeover e resposta do
  atendente; não duplique um segundo compositor.
- `LumeApiQuoteProposalRepository` e as ações idempotentes existentes para
  filas e PDFs de orçamento.
- `TenantApiAuthenticationGateway`, armazenamento criptografado de sessão e
  tratamento central de códigos de erro para autenticação.
- Gateways server-only com validação Zod para novos contratos. Uma futura tela
  de importação/exportação deve reutilizar o contrato publicado pela Tenant API
  e não deve converter arquivos no navegador.

## Fluxo de uma mudança

1. Leia o README e a documentação do domínio afetado.
2. Localize entidade, caso de uso, gateway e componente já existentes.
3. Confirme o contrato real da Tenant API antes de criar tipos ou telas.
4. Implemente a menor mudança completa, incluindo estados de erro e
   responsividade.
5. Atualize testes e documentação no mesmo conjunto de alterações.
6. Execute:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run build
git diff --check
```

## Documentação e ambientes

- Atualize `README.md`, `docs/architecture.md`,
  `docs/tenant-api-integration.md` e `docs/production.md` quando contratos,
  configuração ou operação mudarem.
- Mantenha `.env.example` e `.env.production.example` separados em blocos,
  indicando o que é obrigatório, opcional, público ou secreto.
- Nunca versione `.env`, `.env.local`, cookies, tokens, chaves de API ou dados
  pessoais.
- Diferencie validação local de prova ponta a ponta. Não declare deploy,
  entrega pelo WhatsApp ou funcionamento em produção sem evidência real.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
