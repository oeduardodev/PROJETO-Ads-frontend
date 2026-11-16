import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyCandidate,
  officialUrl,
  parseHtmlCandidates,
  parseRssCandidates,
  parseSitemapCandidates,
  robotsAllowsPath,
  validatedItems,
} from './official-feed-core.mjs';

const source = {
  institutionId: 550,
  acronym: 'UEPB',
  state: 'PB',
  url: 'https://uepb.edu.br/',
};

test('keeps undergraduate selection pages and editais with distinct labels', () => {
  assert.deepEqual(
    classifyCandidate(
      'Edital 014/2026 - Ingresso de graduados',
      'https://uepb.edu.br/prograd/edital-014-2026/',
      2026,
    ),
    { category: 'Ingresso de graduados', pageKind: 'edital' },
  );
  assert.deepEqual(
    classifyCandidate('Transferência externa', 'https://uepb.edu.br/prograd/transferencia/', 2026),
    { category: 'Transferência', pageKind: 'selection_page' },
  );
  assert.equal(
    classifyCandidate('Vagas remanescentes de graduação 2026', 'https://uepb.edu.br/vagas/', 2026)
      ?.category,
    'Processo Seletivo Especial',
  );
  for (const title of [
    'Reocupação de vagas residuais de graduação',
    'Mobilidade acadêmica para vagas ociosas de graduação 2027',
    'Processo seletivo especial para cursos superiores',
  ]) {
    assert.equal(
      classifyCandidate(title, 'https://uepb.edu.br/processos/', 2026)?.category,
      'Processo Seletivo Especial',
    );
  }
});

test('rejects related news that is not an undergraduate admission opportunity', () => {
  for (const title of [
    'UEA abre vagas remanescentes para curso pré-vestibular 2026',
    'Vagas remanescentes no Dinter em Saúde 2026',
    'Cursos livres de idiomas abrem vagas remanescentes 2026',
    'Vagas remanescentes em curso de idioma 2026',
    'Edital de vagas remanescentes para cursos técnicos 2026',
    'Convocação de aprovados em transferência externa 2026',
    'Cadastramento de aprovados em transferência externa 2026',
    'Portador de Diploma homologa inscrições 2026',
    'Resultado da seleção de transferência externa 2026',
    'SiSU: vagas remanescentes 2026',
    'Edital 2025 para ingresso de graduados',
  ]) {
    assert.equal(classifyCandidate(title, 'https://uepb.edu.br/noticia/', 2026), null, title);
  }
});

test('only emits links on the observed official host', () => {
  assert.equal(
    officialUrl('https://uepb.edu.br/edital/?utm_source=x', source.url),
    'https://uepb.edu.br/edital/',
  );
  assert.equal(officialUrl('https://uepb.edu.br.evil.test/edital/', source.url), null);
  assert.equal(officialUrl('https://evil.test/edital/', source.url), null);
  assert.equal(officialUrl('http://uepb.edu.br/edital/', source.url), null);
  assert.equal(officialUrl('https://user:password@uepb.edu.br/edital/', source.url), null);
});

test('extracts candidates from official HTML, RSS and sitemap data', () => {
  const html = '<a href="/edital-transferencia-2026">Edital 2026 transferência externa</a>';
  const rss =
    '<rss><channel><item><title>Ingresso de graduados 2026</title><link>https://uepb.edu.br/graduados/</link></item></channel></rss>';
  const sitemap =
    '<urlset><url><loc>https://uepb.edu.br/vagas-remanescentes-2026/</loc></url></urlset>';
  const candidates = [
    ...parseHtmlCandidates(html, source.url),
    ...parseRssCandidates(rss, source.url),
    ...parseSitemapCandidates(sitemap, source.url),
  ];
  assert.equal(candidates.length, 3);
  assert.equal(validatedItems(candidates, source, '2026-11-16T00:00:00.000Z').length, 3);
});

test('respects robots agent groups, wildcard paths and explicit allows', () => {
  const robots = [
    'User-agent: *',
    'Disallow: /private*',
    'Allow: /private/public$',
    '',
    'User-agent: AlemDoSiSU-OfficialFeed',
    'Disallow: /blocked*',
    'Allow: /blocked/open$',
  ].join('\n');
  assert.equal(robotsAllowsPath(robots, '/private/data'), true);
  assert.equal(robotsAllowsPath(robots, '/blocked/data'), false);
  assert.equal(robotsAllowsPath(robots, '/blocked/open'), true);
  assert.equal(robotsAllowsPath(robots, '/blocked/open/more'), false);
  assert.equal(robotsAllowsPath('User-agent: *\nDisallow: /private*', '/private/data'), false);
});
