# Design system Lume

Esta aplicação usa os componentes base em `src/shared/ui` e tokens semânticos em
`src/app/globals.css`. A auditoria cobre autenticação, shell, dashboard, agentes
de IA, WhatsApp, orçamentos, usuários, documentos, perfil, suporte e licença.

## Registry e proteção das customizações

`components.json` usa `base-nova`, React Server Components, Tailwind CSS 4 sem
arquivo de configuração, variáveis CSS, ícones Lucide e aliases `@/shared/ui`,
`@/shared/lib` e `@/shared/hooks`. A identidade Lume continua nos tokens; o
registry shadcn fornece infraestrutura, não a marca.

Em 29/08/2026, `npx shadcn@latest add --all --dry-run` encontrou 62 itens: 61
colisões com arquivos já existentes e somente `questionnaire.tsx` ausente. O
comando real foi executado sem `--overwrite`; todas as colisões foram recusadas
e apenas o arquivo ausente foi criado. `@shadcn/react` passou de 0.2.1 para 0.3.0
porque o primitive `questionnaire` não existe na versão anterior. Nenhuma
alteração automática foi aceita em `components.json`, `globals.css`,
`use-mobile.ts` ou nos componentes existentes.

O inventário atual possui 61 componentes TSX no nível principal, um componente
customizado aninhado (`section-heading`) e um teste de primitive. Atualizações
futuras devem repetir primeiro o `--dry-run`/`--diff`, comparar cada colisão e
nunca usar `--overwrite` em lote. Em especial, `button`, `toast`, `field`,
`sidebar`, `message`, `bubble`, `accordion`, `dropdown-menu` e `empty` possuem
contratos ou estilos consumidos pela aplicação.

## Identidade e tema

- tipografia: Geist e Geist Mono, carregadas por `next/font`;
- superfícies: Stone 50 (`#FAF9F6`) no tema claro e Stone 950 (`#1C1B18`) no escuro;
- primária: Amber 500 (`#F59E0B`), com Amber 600 (`#D97706`) para foco e ênfase;
- sucesso: Green 500 (`#22C55E`);
- erro/destrutivo: Red 500 (`#EF4444`);
- transições: 150–180 ms, desativadas quando `prefers-reduced-motion` está ativo.

Os valores 500 são usados em preenchimentos e decoração. Texto e ícones pequenos
usam os tokens de maior contraste `primary-emphasis`, `success-emphasis`,
`warning-emphasis` e `destructive-emphasis`. O token `input` é mais contrastante
que `border`: controles precisam de limite visual de pelo menos 3:1, enquanto
cards e separadores podem manter bordas discretas.

Componentes de domínio não devem usar classes fixas de paleta como `blue-*`,
`emerald-*` ou hexadecimais. Use `background`, `card`, `foreground`, `muted`,
`primary`, `accent`, `success`, `warning`, `destructive`, `info` e suas variantes
`foreground`/`emphasis`.

## Componentes revisados

| Componente    | Aplicação ou decisão                                                    |
| ------------- | ----------------------------------------------------------------------- |
| Progress      | Progresso de solicitações e revisão documental.                         |
| Select        | Filtros, políticas, decisões e administração de usuários.               |
| Separator     | Divisões semânticas; não substitui toda borda estrutural.               |
| Bubble        | Mensagens e estados compactos do WhatsApp.                              |
| Checkbox      | Login, seleção documental e permissões.                                 |
| Collapsible   | Navegação e seções documentais expansíveis.                             |
| Combobox      | Seleção pesquisável de usuários em solicitações avulsas.                |
| Dialog        | Confirmações, formulários e revisão documental.                         |
| Drawer        | Central de notificações e superfícies móveis.                           |
| Input         | Campos textuais e de busca.                                             |
| Scroll Area   | Filas e listas longas com altura controlada.                            |
| Sheet         | Primitive disponível; a adoção por componentes de domínio é explícita.  |
| Textarea      | Observações, motivos e mensagens.                                       |
| Toast         | Confirmações transitórias; erros de formulário continuam também inline. |
| Toggle        | Alternância de tema e controles binários adequados.                     |
| Tooltip       | Complemento para ações apenas com ícone; nunca é o único rótulo.        |
| Accordion     | Documentos aprovados e conteúdo concluído.                              |
| Tabs          | Agrupamento por situação documental.                                    |
| Questionnaire | Fluxos guiados futuros; ainda sem consumidor de domínio.                |

## Componentes instalados sem adoção funcional

- **Calendar:** está instalado, mas os fluxos atuais ainda usam `date` e
  `datetime-local` nativos, que preservam teclado móvel, timezone e o contrato
  das Server Actions. Um Date Picker só deve ser composto quando existir seleção
  de intervalo ou bloqueio de datas que justifique outra camada.
- **Hover Card:** informações essenciais precisam estar disponíveis em toque e
  teclado, sem depender de hover.
- **Toggle Group:** não existe atualmente um conjunto compacto de opções
  mutuamente relacionadas que justifique o componente.
- **Questionnaire:** o primitive oficial está disponível, mas textos padrão em
  inglês não devem chegar à interface; cada composição de domínio fornece copy
  em português e valida seu próprio contrato.

Também permanecem nativos os inputs ocultos das Server Actions, seletores de
arquivo, links de download e linhas ricas de seleção. Recharts, previews de mídia,
tabelas e a sidebar continuam customizados ou compostos sobre primitives porque
não possuem substituto shadcn que melhore sua semântica.

## Acessibilidade e manutenção

- `AuthenticatedShell` possui o único landmark `main` das rotas autenticadas;
- foco usa o token `ring`, visível em ambos os temas;
- controles com ícone conservam nome acessível e Tooltip complementar;
- listas extensas usam busca ou rolagem dimensionada;
- a marca principal é sempre Lume; nome do cliente pode ser exibido como contexto,
  sem controlar a paleta do produto;
- alterações devem ser verificadas em 320–390 px, 200% de zoom, claro e escuro.
