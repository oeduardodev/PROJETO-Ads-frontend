# Atualização do feed nacional

O comando `scripts/update-official-feed.mjs` lê a [auditoria institucional](institution-source-audit.md), consulta fontes oficiais acessíveis e grava `apps/web/public/official-feed.json` de forma atômica. O frontend usa esse arquivo mesmo sem a API ou Docker. Quando a API está ativa, ela também lê o mesmo arquivo e acrescenta os links dos quatro portais da Paraíba. A interface combina os dois conjuntos sem repetir URLs.

Para atualizar uma vez, na pasta `frontend`:

```powershell
corepack pnpm feed:update
```

Para manter a coleta a cada seis horas durante o desenvolvimento local:

```powershell
corepack pnpm feed:watch
```

Os comandos carregam `LLM_PROVIDER_KEY` do `backend/.env`, que fica fora do Git. O Gemini seleciona IDs de páginas já encontradas; se a chave estiver indisponível ou houver limite de chamadas, a filtragem local continua. É possível rodar sem a chave com `node --use-system-ca scripts/update-official-feed.mjs`. O parâmetro `--fresh` refaz o snapshot sem aproveitar resultados anteriores; use apenas para reconstrução deliberada. O modo normal conserva o último resultado válido por fonte quando uma consulta falha.

As estratégias são API WordPress, RSS, sitemap e doze páginas de seleção verificadas, cobrindo as 27 UFs. O programa consulta `robots.txt` e respeita proibições explícitas, valida HTTPS, host e tamanho da resposta, limita candidatos por fonte e registra em `sources[]` a tentativa, o sucesso, o método e o erro. Redirecionamentos para desafios antibot não são tratados como conteúdo. O arquivo tem `version=1`, `checkedAt`, `items[]` e `sources[]`.

Cada item tem código Inep, sigla, UF, título, categoria, URL, URL da fonte, data da checagem e tipo de página (`edital` ou `selection_page`). A interface sempre indica que o prazo não foi confirmado. A presença de um título não demonstra inscrições abertas, vagas ou elegibilidade. O modelo não cria URLs; a validação local só aceita links que pertencem ao host oficial consultado.

Em 16/11/2026, a execução local gerou 248 links de 52 instituições nas 27 UFs. O diretório contém 317 instituições; os registros sem site confirmado continuam com estado pendente. A cobertura por UF não significa que haja um edital identificado em todas as instituições.

O workflow `.github/workflows/official-feed.yml` atualiza e publica o snapshot no ramo `main` a cada seis horas depois que este código chegar ao GitHub. A variável secreta opcional `LLM_PROVIDER_KEY` habilita a classificação pelo Gemini nesse ambiente; sem ela, as regras locais continuam a operar. A execução local usa a chave de `backend/.env`. O GitHub Actions precisa de permissão de escrita no repositório e de um ramo que aceite os commits automáticos. Consulte `sources[]` no snapshot para diagnóstico por fonte.
