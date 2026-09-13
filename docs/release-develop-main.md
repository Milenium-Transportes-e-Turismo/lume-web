# Promoção de develop para main — Web

Preparação de 13/09/2026. Base remota `944068ade8ac1041c283bf6f08cf52bf86d9cdf6`;
candidato funcional `fa3dd854407b08f8b56af610648119f85cd8193c`, acrescido desta
preparação. São 30 commits funcionais acumulados; a base remota é ancestral do
candidato. Registre no PR o SHA final aprovado, sem usar a main local de staging
como referência de produção.

## Conteúdo da versão

- Cadastro PF/PJ, conciliação e exportação de contatos aprovados.
- Gestão documental, titularidade pessoal e tratamento de falhas de consulta.
- Roteirização, navegação responsiva e organização da sidebar.
- CNPJs próprios, frota e catálogos, contratos/vínculos no perfil e registros Avic.
- Atendimento WhatsApp com sessões nativas, autoria e estado real de entrega,
  configurações dos canais/agentes e sugestões privadas durante controle humano.

A API é a fonte autoritativa das regras e estados; a Web não acessa diretamente
Avic, Evolution ou os provedores de IA. A versão depende da API candidata e das
suas migrações. Não publique a Web nova contra a API antiga da main.

## Liberação e ordem de implantação

1. Conferir os quatro PRs develop → main, nos remotos `origin` e `milenium`, e
   preservar os remotos/upstream existentes. A cópia de repositório não replica
   segredos, regras de proteção, configurações de Actions ou ambientes GitHub.
2. Concluir a preparação da API em `docs/release-develop-main.md` daquele
   repositório. Há 36 migrações acumuladas e uma limpeza legada com DROP TABLE;
   são necessários inventário de dados, PostgreSQL com PostGIS, configuração dos
   agentes e ensaio de atualização/recuperação. A saúde do staging não substitui
   essas verificações no destino.
3. Após aprovação explícita, integrar a API na main, executar a implantação
   autorizada e conferir migrações, bootstrap e readiness. Integrar a Web na main
   e construir a imagem correspondente somente com essa dependência atendida.
4. Preservar SESSION_SECRET, URL privada da API, redes, portas e domínio da
   instalação. AUTH_SIMULATION_ENABLED deve ser false e a fonte WhatsApp, api.
   NEXT_PUBLIC_* é incorporado na compilação e não pode conter segredo.
5. Construir pelo Dockerfile oficial (Node 22, Next standalone e usuário não-root),
   identificar a imagem pelo SHA aprovado e testar uma réplica sem tráfego antes
   de substituir a atual. O build precisa de HTTPS para obter fontes.
6. Conferir `/api/health`, `/api/readiness` e teste autenticado: login, autorização,
   documentos próprios, frota/catálogos, vínculos/contratos, leitura de registros,
   resumo legível, novo orçamento preservando o anterior e transferência humana.
   A assistência interna não pode enviar resposta ao cliente sem a decisão do
   operador. Mensagens reais de teste dependem de autorização específica.
7. Promover somente depois dessas verificações, registrar o digest executado e
   observar falhas de autenticação, conflitos, erros 5xx e indisponibilidade da API.

## Validação e limites da preparação

O candidato funcional foi validado na VPS: TypeScript, lint, build e 1.006 testes
em 170 suítes passaram. Os registros estão em
`/home/taiane/lume/lume-staging/diagnostics/avic-offset-form-20260911`. O código
funcional não mudou nesta preparação. A formatação global contém 72 divergências
preexistentes fora dos arquivos alterados; a formatação dos arquivos alterados
é validada separadamente. Não há workflow de CI versionado na Web nesta revisão.

A preparação gera PRs em rascunho e não executa merge, mudança de branch nos
serviços, migração ou deploy de produção. A liberação também depende de CI da API
aprovada no SHA final; não tratar testes unitários aprovados como cobertura ou
E2E automaticamente aprovados.

## Recuperação

Preserve digest e configuração da Web anterior. Retornar somente o frontend à
imagem anterior não reverte o schema da API. A recuperação coordenada do pacote
precisa considerar as migrações e dados alterados pela API antes de disponibilizar
uma combinação antiga de serviços. Não remova volumes, configurações ou imagens
necessárias à recuperação. Consulte [produção](production.md) e
[ambientes](deployment-environments.md).
