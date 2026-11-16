# Cadastro nacional e links oficiais

A primeira versão funciona sem aprovação administrativa, API ou banco. O diretório `/instituicoes` contém as 317 instituições da rede pública do Censo da Educação Superior 2024: 122 federais, 139 estaduais e 56 municipais, nas 27 UFs. Essa era a edição mais recente disponível na página de microdados consultada em 13/11/2026. Não é um cadastro em tempo real de instituições criadas após 2024.

A busca aceita nome, sigla, código Inep e município, com filtros por UF da sede e esfera administrativa e paginação. Regional não é uma categoria administrativa distinta: cada instituição conserva sua esfera oficial. Os 28 registros da categoria especial (código 7) ficam agrupados em Municipal conforme os totais do Resumo Técnico do Inep, com a categoria original preservada. Não se infere gratuidade para eles.

Os links de seleção ainda cobrem UFPB, UFCG, UEPB e IFPB. Os outros 313 registros não têm portal de seleção confirmado. A [auditoria de fontes](institution-source-audit.md) acrescenta sites institucionais que responderam à checagem de acesso, identificados por correspondência conservadora com o ROR. Nenhuma URL foi deduzida de sigla ou nome. `/oportunidades` combina os links conhecidos com os links encontrados periodicamente pelo endpoint `/api/v1/official-feed`, quando a API está disponível. Esse feed consulta somente os quatro portais confirmados e usa Gemini para selecionar páginas sobre formas alternativas de ingresso, sem aprovação manual. O diretório nacional não significa cobertura nacional de editais ou inscrições abertas. A atualização não extrai nem confirma prazos, vagas ou requisitos.

## Origem e reprodução

`data/inep/public-institutions-2024.csv` é a projeção dos campos cadastrais do arquivo oficial `MICRODADOS_ED_SUP_IES_2024.CSV`, filtrado por `TP_REDE=1`. `data/inep/provenance.json` registra a URL, data de obtenção, SHA-256 do CSV original e contagens. O código Inep é a identidade estável; siglas podem se repetir. A localização é a sede, não a relação de campi.

Fonte: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior

Totais por esfera: https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_superior/resumo_tecnico_do_censo_da_educacao_superior_2024.pdf

Para regenerar a lista a partir da projeção versionada:

```powershell
py scripts/generate-national-institutions.py
corepack pnpm exec prettier --write apps/web/src/app/features/official-catalog/national-institutions.ts
```

O cadastro é versionado no frontend; não foi importado no banco legado de revisão. A atualização da base e a ampliação de URLs são explícitas. Para acrescentar um portal, use o código Inep no mapa `SELECTION_PORTALS` em `official-links.ts` e um endereço HTTPS confirmado no site institucional; o backend precisa conhecer a mesma fonte. Não presuma que uma página de seleção representa inscrições abertas.
