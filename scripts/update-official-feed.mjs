import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CATEGORIES,
  fetchWithBackoff,
  officialUrl,
  parseHtmlCandidates,
  parseRssCandidates,
  parseSitemapCandidates,
  robotsAllowsPath,
  validatedItems,
} from './official-feed-core.mjs';

const root = resolve(import.meta.dirname, '..');
const auditPath = resolve(root, 'data/inep/institution-source-audit.json');
const outputPath = resolve(
  root,
  process.env.OFFICIAL_FEED_SNAPSHOT_PATH ?? 'apps/web/public/official-feed.json',
);
const audit = JSON.parse(await readFile(auditPath, 'utf8'));
const byId = new Map(audit.institutions.map((item) => [item.id, item]));
const selectionPortals = [
  [
    579,
    'https://www.prg.ufpb.br/editais/',
    'Editais de transferência, reopção e ingresso de graduados',
  ],
  [2564, 'https://comprov.ufcg.edu.br/graduacao.html', 'Processo Seletivo Especial de graduação'],
  [
    550,
    'https://uepb.edu.br/prograd/processos-seletivos/',
    'Processos seletivos especiais de graduação',
  ],
  [1166, 'https://estudante.ifpb.edu.br/editais/', 'Processos seletivos especiais de graduação'],
  [
    549,
    'https://www3.ufac.br/prograd/processo-seletivo-para-preenchimento-de-vagas-residuais',
    'Processo seletivo de vagas residuais de graduação',
  ],
  [
    577,
    'https://servicos.ufal.br/orgaos/departamento-de-registro-e-controle-academico-drca/ingressar-na-ufal-por-meio-de-transferencia',
    'Transferência externa para cursos de graduação',
  ],
  [
    2,
    'https://unb.br/docente-vida-academica/graduacao/formas-de-ingresso/2-publicacoes/570-transferencia-facultativa',
    'Transferência facultativa para graduação',
  ],
  [
    569,
    'https://www.ceps.ufpa.br/index.php/moba2027',
    'Mobilidade acadêmica para vagas ociosas de graduação 2027',
  ],
  [
    570,
    'https://comperve.ufrn.br/conteudo/extravestibular.php',
    'Reocupação de vagas residuais de graduação',
  ],
  [4785, 'https://selecao.ifro.edu.br/especial', 'Processo seletivo especial de graduação'],
  [
    582,
    'https://www.ufsm.br/pro-reitorias/prograd/ingresse-na-ufsm/edital-de-ingresso-reingresso',
    'Ingresso e reingresso por transferência externa e portador de diploma',
  ],
  [
    3,
    'https://prograd.ufs.br/pagina/33013-editais-prograd-2026',
    'Editais de transferência externa e portador de diploma 2026',
  ],
  [
    6,
    'https://prograd.ufop.br/processos-seletivos/reingresso-transferencia-reopcao/processo-seletivo-ocupacao-de-vagas-residuais',
    'Processo seletivo de vagas residuais para transferência e portador de diploma',
  ],
  [
    8,
    'https://www2.pse.ufv.br/?page_id=38',
    'Vagas ociosas de graduação por transferência e portador de diploma',
  ],
  [
    568,
    'https://transferencia.uema.br/',
    'Transferência externa e portador de diploma de graduação 2027',
  ],
  [573, 'https://ps.ufes.br/psvo2026', 'Processo seletivo de vagas ociosas de graduação 2026'],
  [
    584,
    'https://prograd.ufg.br/n/204436-edital-de-preenchimento-de-vagas-remanescentes-para-portador-de-diploma',
    'Edital de vagas remanescentes para portador de diploma 2027',
  ],
  [
    585,
    'https://dae.ufsc.br/transferencias-e-retornos/',
    'Transferência externa e retorno de graduados para graduação',
  ],
  [
    586,
    'https://acessograduacao.ufrj.br/periodo-2026-1/editais-acesso-2026/editais-de-vagas-ociosas-2026-2',
    'Editais de vagas ociosas para graduação 2026/2',
  ],
  [
    9,
    'https://sites.uel.br/prograd/graduacao/transferencia-externa/',
    'Transferência externa para cursos de graduação',
  ],
];
const sources = [
  ...audit.institutions
    .filter(
      (item) => item.websiteReachable && (item.wordpressSearchApi || item.rssFeed || item.sitemap),
    )
    .map((item) => ({
      key: `${item.id}:site`,
      institutionId: item.id,
      acronym: item.acronym,
      state: item.state,
      url: new URL(item.website).origin + '/',
      wordpress: item.wordpressSearchApi,
      rss: item.rssFeed,
      sitemap: item.sitemap,
      html: false,
    })),
  ...selectionPortals.map(([id, url, title]) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Missing institution ${id}`);
    return {
      key: `${id}:selection`,
      institutionId: id,
      acronym: item.acronym,
      state: item.state,
      url,
      title,
      wordpress: false,
      rss: false,
      sitemap: false,
      html: true,
    };
  }),
];
const maxSources = Number(
  process.argv.find((arg) => arg.startsWith('--max-sources='))?.split('=')[1] ?? sources.length,
);
const dryRun = process.argv.includes('--dry-run');
const watch = process.argv.includes('--watch');
const fresh = process.argv.includes('--fresh');
if (!Number.isSafeInteger(maxSources) || maxSources < 1) throw new Error('Invalid --max-sources');
if (maxSources < sources.length && !dryRun) {
  throw new Error('--max-sources requires --dry-run');
}
const robotsCache = new Map();
let geminiRateLimited = false;

async function robotsAllows(url, source) {
  const host = new URL(source.url).hostname;
  if (!robotsCache.has(host)) {
    robotsCache.set(
      host,
      (async () => {
        try {
          const response = await fetch(`https://${host}/robots.txt`, {
            signal: AbortSignal.timeout(5_000),
            headers: { 'user-agent': 'AlemDoSiSU-OfficialFeed/1.0' },
          });
          if (!response.ok || new URL(response.url).hostname !== host) return '';
          if (Number(response.headers.get('content-length')) > 100_000) return '';
          const body = await response.text();
          return body.length <= 100_000 ? body : '';
        } catch {
          return '';
        }
      })(),
    );
  }
  const content = await robotsCache.get(host);
  if (!content) return true;
  const target = new URL(url);
  return robotsAllowsPath(content, target.pathname + target.search);
}

async function responseText(url, source, accept, maxBytes = 500_000) {
  if (!(await robotsAllows(url, source))) throw new Error('ROBOTS_DISALLOW');
  const response = await fetchWithBackoff(() =>
    fetch(url, {
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
      headers: { accept, 'user-agent': 'AlemDoSiSU-OfficialFeed/1.0' },
    }),
  );
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  if (new URL(response.url).hostname !== new URL(source.url).hostname) {
    throw new Error('OFF_DOMAIN_REDIRECT');
  }
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('TOO_LARGE');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error('TOO_LARGE');
  return {
    text: new TextDecoder().decode(bytes),
    contentType: response.headers.get('content-type') ?? '',
  };
}

async function wordpressCandidates(source) {
  const terms = [
    'transferência',
    'ingresso de graduados',
    'vagas remanescentes',
    'reopção',
    'portador de diploma',
  ];
  const results = [];
  for (let offset = 0; offset < terms.length; offset += 2) {
    const batch = await Promise.allSettled(
      terms.slice(offset, offset + 2).map(async (term) => {
        const url = new URL('/wp-json/wp/v2/search', source.url);
        url.searchParams.set('search', term);
        url.searchParams.set('per_page', '10');
        const response = await responseText(url, source, 'application/json', 200_000);
        if (!response.contentType.includes('application/json')) throw new Error('NOT_JSON');
        const items = JSON.parse(response.text);
        if (!Array.isArray(items)) throw new Error('INVALID_JSON');
        return items
          .filter((item) => typeof item?.title === 'string' && typeof item?.url === 'string')
          .map((item) => ({ title: item.title, url: item.url }));
      }),
    );
    results.push(...batch);
  }
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  if (!fulfilled.length) throw new Error('WORDPRESS_SEARCH_UNAVAILABLE');
  return fulfilled.flatMap((result) => result.value);
}

async function rssCandidates(source) {
  const url = new URL('/feed/', source.url);
  const response = await responseText(
    url,
    source,
    'application/rss+xml,application/atom+xml,text/xml',
  );
  if (!/xml|rss|atom/iu.test(response.contentType)) throw new Error('NOT_XML');
  return parseRssCandidates(response.text, source.url);
}

async function sitemapCandidates(source) {
  const url = new URL('/sitemap.xml', source.url);
  const response = await responseText(url, source, 'application/xml,text/xml', 1_000_000);
  if (!/xml/iu.test(response.contentType)) throw new Error('NOT_XML');
  const candidates = parseSitemapCandidates(response.text, source.url);
  if (!/<sitemapindex\b/iu.test(response.text)) return candidates;
  const childMaps = [...response.text.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/giu)]
    .map((match) => officialUrl(match[1], source.url))
    .filter((value) => value && /sitemap|\.xml/iu.test(value))
    .slice(0, 4);
  for (const child of childMaps) {
    try {
      const next = await responseText(child, source, 'application/xml,text/xml', 1_000_000);
      candidates.push(...parseSitemapCandidates(next.text, source.url));
    } catch {
      // Other sitemap files may still be available.
    }
  }
  return candidates;
}

async function htmlCandidates(source) {
  const response = await responseText(source.url, source, 'text/html', 1_000_000);
  if (!response.contentType.includes('text/html')) throw new Error('NOT_HTML');
  return [
    ...(source.title ? [{ title: source.title, url: source.url }] : []),
    ...parseHtmlCandidates(response.text, source.url),
  ];
}

async function classifyWithGemini(source, items) {
  const key = process.env.LLM_PROVIDER_KEY;
  if (!key || !items.length) return { items, status: key ? 'no_candidates' : 'no_key' };
  if (geminiRateLimited) return { items, status: 'quota_fallback' };
  const candidates = items.slice(0, 35);
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: JSON.stringify({
                    task: 'Select candidate IDs that are official pages or editais for alternative entry to undergraduate courses at this institution. Include transfer, degree holders, course change, remaining vacancies and special selections. Exclude ordinary SiSU, postgraduate programs, jobs, scholarships, result-only pages and rankings. Use only supplied IDs. Return JSON with ids array.',
                    institution: source.acronym,
                    candidates: candidates.map((item, id) => ({
                      id,
                      title: item.title,
                      url: item.url,
                    })),
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 512,
            temperature: 0,
          },
        }),
      },
    );
    if (response.status === 429) geminiRateLimited = true;
    if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
    const payload = await response.json();
    const content = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    const selected = JSON.parse(content);
    if (!Array.isArray(selected.ids)) throw new Error('GEMINI_INVALID_RESPONSE');
    const ids = new Set(
      selected.ids.filter((id) => Number.isSafeInteger(id) && id >= 0 && id < candidates.length),
    );
    return { items: candidates.filter((_, id) => ids.has(id)), status: 'confirmed' };
  } catch (error) {
    return { items, status: error instanceof Error ? error.message.slice(0, 60) : 'GEMINI_ERROR' };
  }
}

async function collect(source, previousItems, previousStatus, now) {
  const attempted = [];
  let raw = [];
  let method = null;
  let lastError = null;
  for (const [enabled, name, fetchCandidates] of [
    [source.wordpress, 'wordpress', wordpressCandidates],
    [source.rss, 'rss', rssCandidates],
    [source.sitemap, 'sitemap', sitemapCandidates],
    [source.html, 'html', htmlCandidates],
  ]) {
    if (!enabled) continue;
    attempted.push(name);
    try {
      raw = await fetchCandidates(source);
      method = name;
      if (validatedItems(raw, source, now).length) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 80) : 'FETCH_ERROR';
    }
  }
  if (!method) {
    return {
      items: previousItems,
      status: {
        ...previousStatus,
        key: source.key,
        institutionId: source.institutionId,
        acronym: source.acronym,
        state: source.state,
        url: source.url,
        lastAttempt: now,
        error: lastError ?? 'NO_AVAILABLE_METHOD',
        attempted,
      },
    };
  }
  const deterministic = validatedItems(raw, source, now);
  const ai = await classifyWithGemini(source, deterministic);
  const items = ai.status === 'confirmed' ? ai.items : deterministic;
  return {
    items: items.length ? items : previousItems,
    status: {
      key: source.key,
      institutionId: source.institutionId,
      acronym: source.acronym,
      state: source.state,
      url: source.url,
      lastAttempt: now,
      lastSuccess: now,
      error: null,
      method,
      attempted,
      candidateCount: raw.length,
      resultCount: items.length,
      aiStatus: ai.status,
    },
  };
}

async function loadPrevious() {
  if (fresh) return { version: 1, items: [], sources: [] };
  try {
    const data = JSON.parse(await readFile(outputPath, 'utf8'));
    return data.version === 1 && Array.isArray(data.items) && Array.isArray(data.sources)
      ? data
      : { version: 1, items: [], sources: [] };
  } catch {
    return { version: 1, items: [], sources: [] };
  }
}

async function update() {
  const previous = await loadPrevious();
  const now = new Date().toISOString();
  const itemsBySource = new Map();
  for (const item of previous.items) {
    const key = item.sourceKey;
    if (!itemsBySource.has(key)) itemsBySource.set(key, []);
    itemsBySource.get(key).push(item);
  }
  const statuses = new Map(previous.sources.map((item) => [item.key, item]));
  const selectedSources = sources.slice(0, maxSources);
  let cursor = 0;
  let completed = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < selectedSources.length) {
        const source = selectedSources[cursor++];
        const result = await collect(
          source,
          itemsBySource.get(source.key) ?? [],
          statuses.get(source.key) ?? {},
          now,
        );
        const previousByUrl = new Map(
          (itemsBySource.get(source.key) ?? []).map((item) => [item.url, item]),
        );
        itemsBySource.set(
          source.key,
          result.items.map((item) => ({
            ...item,
            sourceKey: source.key,
            discoveredAt:
              previousByUrl.get(item.url)?.discoveredAt ??
              previousByUrl.get(item.url)?.checkedAt ??
              now,
          })),
        );
        statuses.set(source.key, result.status);
        completed += 1;
        if (completed % 10 === 0 || completed === selectedSources.length) {
          console.log(`Updated ${completed}/${selectedSources.length} sources`);
        }
      }
    }),
  );
  const items = [...itemsBySource.values()].flat();
  const unique = [...new Map(items.map((item) => [item.url, item])).values()].sort(
    (a, b) =>
      a.state.localeCompare(b.state) ||
      a.institution.localeCompare(b.institution) ||
      a.title.localeCompare(b.title),
  );
  const snapshot = {
    version: 1,
    checkedAt: now,
    sourceCount: sources.length,
    items: unique,
    sources: [...statuses.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
  console.log(
    JSON.stringify({
      sources: selectedSources.length,
      items: unique.length,
      errors: snapshot.sources.filter((item) => item.error).length,
    }),
  );
  if (!dryRun) {
    const temp = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(snapshot, null, 2) + '\n');
    await rename(temp, outputPath);
  }
}

await update();
if (watch)
  setInterval(() => void update().catch((error) => console.error(error)), 6 * 60 * 60 * 1000);
