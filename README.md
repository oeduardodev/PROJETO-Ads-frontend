# Além do SiSU — frontend

Este repositório contém o Angular. O backend NestJS e a documentação canônica ficam no checkout irmão `../backend`. Os remotos GitHub ainda estão vazios por decisão de não fazer push; use os dois checkouts locais para reproduzir o estado atual.

## Rodar a interface

Instale Node.js 24.15.0 e Corepack. No PowerShell, na raiz deste repositório:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @alem-do-sisu/web exec ng serve --host 127.0.0.1 --port 4200
```

Abra `http://127.0.0.1:4200/`. O shell funciona sem API e informa que o catálogo está em preparação. Para iniciar PostgreSQL, Redis, API e worker, siga [o README do backend](../backend/README.md) no checkout local. O desenvolvimento usa `http://127.0.0.1:3000` como URL pública da API; nenhuma credencial privada entra em `src/environments/`.

A telemetria opcional do Angular CLI está desativada na configuração do projeto para evitar uma pergunta interativa no primeiro `ng serve`.

## Verificar

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

O teste `test:e2e` atual confirma apenas que o servidor de desenvolvimento entrega o HTML em português; a suíte de navegador completa vem em etapa posterior. A referência visual `style-reference.png` do workspace orienta a composição da interface; o shell atual usa os tokens e a composição completa virá nas etapas de design e catálogo. Veja também [docs/engineering/local-development.md](docs/engineering/local-development.md).
