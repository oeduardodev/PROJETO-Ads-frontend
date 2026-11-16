# Auditoria de fontes institucionais

O arquivo `data/inep/institution-source-audit.csv` apresenta uma linha por instituição pública do cadastro Inep 2024, identificada pelo código `CO_IES`. O JSON homônimo preserva os mesmos resultados e a data da verificação. A origem do cadastro está registrada em `data/inep/provenance.json`.

## Resultado após a revisão de acesso em 15/11/2026

| Situação do cruzamento e acesso                                 | Instituições |
| --------------------------------------------------------------- | -----------: |
| Site institucional respondeu por HTTPS                          |          163 |
| Registro do ROR encontrado, mas o site não respondeu à checagem |           18 |
| Sem correspondência única no ROR                                |          131 |
| Sigla ambígua no ROR                                            |            5 |

Entre os 163 sites acessíveis, 57 expõem a API de busca do WordPress; em 49 deles a consulta retornou ao menos um título compatível com os termos testados. Também foram detectados 62 feeds RSS e 66 sitemaps XML. São características técnicas do site, não fontes de editais aprovadas para ingestão. O CSV lista os resultados de cada instituição, inclusive os casos sem correspondência.

Dos 43 endereços antes classificados como inacessíveis, 25 passaram a responder após usar a loja de certificados do sistema, ampliar o tempo da checagem e corrigir 14 URLs com evidência institucional. O relatório `data/inep/unreachable-site-cases.csv` contém a causa observada e o resultado atual de cada um dos 43. Entre os 18 restantes, seis retornam um desafio antibot da Radware, quatro retornam erro HTTP e oito falham por DNS ou conexão neste ambiente. Um erro de DNS ou conexão local não prova que o site esteja fora do ar para todos os usuários.

## Procedimento

Para cada uma das 317 instituições, o script `scripts/audit-institution-sources.mjs`:

1. Consulta a [API pública do ROR](https://ror.readme.io/docs/rest-api) pelo nome completo. Aceita um único registro localizado no Brasil com nome idêntico depois de normalização de acentos e pontuação.
2. Se não houver correspondência, consulta a sigla e aceita um único registro com sigla e UF idênticas. Siglas ambíguas ficam sem URL.
3. Obtém o endereço institucional informado pelo ROR; aplica as correções de `data/inep/official-website-corrections.json` quando há evidência oficial de migração ou URL antiga; tenta acessá-lo por HTTPS. Redirecionamentos são aceitos apenas para o mesmo domínio ou um subdomínio do endereço final confirmado.
4. Nos sites que respondem, consulta `/wp-json/wp/v2/search`, `/feed/`, `/sitemap.xml` e `/robots.txt` no domínio de origem. Na API WordPress, pesquisa termos ligados a ingresso de graduados, transferência e vagas remanescentes e conta títulos compatíveis.

`wordpressSearchApi=true` significa que o endpoint WordPress respondeu com uma lista JSON. `admissionApiHits` é uma contagem de títulos com palavras relevantes; **não confirma que os links sejam editais vigentes**. `rssFeed` e `sitemap` indicam apenas que os caminhos testados retornaram XML. `robotsStatus` é o código HTTP observado; o script não interpreta regras de `robots.txt`.

`not_found_in_ror` significa que o cruzamento conservador não encontrou um registro; não prova que a instituição não tenha site ou API. `*_site_unreachable` significa que a tentativa de acesso a partir deste ambiente falhou; o site pode estar funcionando para usuários em navegador. A verificação cobre o domínio institucional indicado pelo ROR e esses quatro caminhos técnicos. Portais em subdomínios, sistemas acadêmicos, APIs privadas ou endpoints com outros caminhos exigem pesquisa adicional.

O [registro ROR da Fatec Praia Grande](https://ror.org/032e34x73) (`CO_IES=4926`) informa uma UF divergente, embora o endereço seja a [página oficial da Fatec Praia Grande no domínio do Centro Paula Souza](https://fatecpg.cps.sp.gov.br/). Esse caso foi conferido na própria página da instituição. A UF é exigida no cruzamento por sigla, mas nomes completos idênticos são cruzados por país e confirmação do site.

Os endereços que responderam são gerados em `apps/web/src/app/features/official-catalog/audited-websites.ts`. No diretório `/instituicoes`, o site institucional é exibido quando não há portal de seleção confirmado. O feed automático de processos ainda usa somente os portais de UFPB, UFCG, UEPB e IFPB. Nenhuma das APIs encontradas nesta auditoria é adicionada automaticamente ao feed, pois a existência de busca genérica não demonstra que a fonte cubra seleções de graduação.

## Reproduzir

Na pasta `frontend`:

```powershell
node --use-system-ca scripts/audit-institution-sources.mjs
node scripts/generate-audited-websites.mjs
corepack pnpm exec prettier --write apps/web/src/app/features/official-catalog/audited-websites.ts
```

A auditoria faz requisições de rede e o resultado reflete o instante da execução. A [API do ROR](https://ror.readme.io/docs/rest-api) tem limite de requisições; para frequência alta, use a distribuição de dados oferecida por eles. Os [microdados do Inep](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior) definem o universo das instituições desta versão.

O parâmetro `--use-system-ca` faz o Node consultar também a loja de certificados confiáveis do sistema, conforme a [documentação do Node.js](https://nodejs.org/api/cli.html#--use-system-ca). A validação TLS continua ativa. O diagnóstico inicial dos 43 casos permanece versionado nos dois arquivos `unreachable-site-diagnostics*.json`; eles comparam a configuração padrão do Node e a loja do sistema. Não use HTTP sem TLS nem desative a verificação do certificado para transformar falha em sucesso.
