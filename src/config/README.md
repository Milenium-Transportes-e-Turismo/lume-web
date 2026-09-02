# Config

Esta pasta concentra configurações globais da aplicação. Variáveis de ambiente
são uma exceção deliberada: os schemas ficam em `src/env.ts`, a leitura privada
em `src/env.server.ts` e a projeção pública em `src/env.public.ts`.

Exemplos:

- configuração de tema
- configuração de autenticação
- configuração de rotas
- configuração de bibliotecas globais

Evite colocar regras de negócio nesta pasta.
