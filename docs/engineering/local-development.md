# Desenvolvimento da interface

O [README](../../README.md) contém os comandos de instalação, execução e testes. A interface usa Angular standalone com Tailwind. `apps/web/src/environments/environment.development.ts` define somente URLs e flags públicas; o build de produção deixa os endereços vazios até a configuração do ambiente de destino. Nenhuma chave de PostgreSQL, Redis, busca ou IA deve aparecer nesses arquivos ou no bundle.

O shell não faz chamadas à API e permanece útil quando o backend está desligado. Quando a API for iniciada conforme o README do checkout `../backend`, ela escuta em `127.0.0.1:3000` e aceita a origem `http://127.0.0.1:4200` indicada em `CORS_ORIGINS`. Se a porta web mudar, ajuste também a origem da API no `.env` local do backend.

O teste unitário atual protege a mensagem de catálogo em preparação; `test:e2e` verifica apenas o HTTP do servidor de desenvolvimento. Busca, filtros, detalhes, acessibilidade completa e testes de navegador serão implementados nos passos correspondentes.
