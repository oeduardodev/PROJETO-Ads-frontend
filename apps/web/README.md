# Interface Além do SiSU

Angular standalone com rotas por feature, TypeScript estrito e Tailwind. Executar na raiz do repositório frontend:

```text
corepack pnpm install
corepack pnpm --filter @alem-do-sisu/web start
corepack pnpm --filter @alem-do-sisu/web build
```

O shell do passo 008 funciona sem API e não lista editais como vigentes. `src/styles.css` contém as cores amostradas de `style-reference.png` fornecida no workspace: marfim `#fcf5ed`, preto `#050505`, verde `#c1fb01`, laranja `#fe6402`, azul `#3845fd` e lilás `#e389fc`. A referência também orienta tipografia sans pesada, recortes inclinados, contornos pretos, sombras deslocadas e grafismo de cartaz. A implementação completa de componentes, busca, cards e tratamento responsivo da referência pertence aos passos 067–068 do roteiro, usando apenas dados com fonte oficial e revisão humana.

O backend mantém arquitetura, ADRs e progresso canônicos. Contrato da API e cliente virão no passo 029. Segredos de coleta/IA não entram no bundle Angular.

# Configuração pública

`src/environments/environment.ts` contém apenas valores que podem aparecer no bundle público. O build de desenvolvimento substitui esse arquivo por `environment.development.ts`. `apiBaseUrl` e `publicSiteUrl` ficam vazios no build de produção até que os endereços oficiais sejam definidos antes de um deploy; o shell atual não faz chamadas à API. Nunca colocar `DATABASE_URL`, `REDIS_URL`, `SEARCH_PROVIDER_KEY` ou `LLM_PROVIDER_KEY` nesses arquivos.
