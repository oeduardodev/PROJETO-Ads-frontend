import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const input = resolve(root, 'data/inep/public-institutions-2024.csv');
const output = resolve(root, 'data/inep/institution-source-audit.json');
const csvOutput = resolve(root, 'data/inep/institution-source-audit.csv');
const checkedOn = new Date().toISOString();
const websiteCorrections = JSON.parse(
  await readFile(resolve(root, 'data/inep/official-website-corrections.json'), 'utf8'),
);

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  return data.map((cells) =>
    Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ''])),
  );
}

function normalized(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function request(url, timeout = 8000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      accept: 'application/json,text/html,application/xml,text/xml;q=0.8',
      'user-agent': 'AlemDoSiSU-Source-Audit/1.0',
    },
  });
  return response;
}

async function probe(url, expected = '', timeout = 6000) {
  try {
    const response = await request(url, timeout);
    const type = response.headers.get('content-type') ?? '';
    let valid = response.ok;
    if (expected === 'json' && valid) {
      const value = await response.json();
      valid = Array.isArray(value);
    } else if (expected === 'xml') {
      valid &&= /xml|rss|atom/u.test(type);
    }
    await response.body?.cancel().catch(() => undefined);
    return { status: response.status, valid, url: response.url, errorCode: null };
  } catch (error) {
    return {
      status: null,
      valid: false,
      url: null,
      errorCode: error.cause?.code ?? error.name,
    };
  }
}

async function admissionApiHits(origin) {
  const urls = new Set();
  for (const term of ['ingresso de graduados', 'transferência', 'vagas remanescentes']) {
    try {
      const endpoint = new URL('/wp-json/wp/v2/search', origin);
      endpoint.searchParams.set('search', term);
      endpoint.searchParams.set('per_page', '10');
      const response = await request(endpoint, 6000);
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
        continue;
      const items = await response.json();
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (typeof item.title !== 'string' || typeof item.url !== 'string') continue;
        const title = normalized(item.title);
        if (!/ingresso de graduados|transferencia|vagas remanescentes/u.test(title)) continue;
        if (/pos graduacao|mestrado|doutorado|resultado|classificacao|convocacao/u.test(title))
          continue;
        const link = new URL(item.url);
        if (link.protocol === 'https:' && link.hostname === new URL(origin).hostname)
          urls.add(link.toString());
      }
    } catch {
      // One search term failing does not erase other observations.
    }
  }
  return urls.size;
}

async function auditInstitution(row) {
  const id = Number(row.CO_IES);
  const result = {
    id,
    name: row.NO_IES,
    acronym: row.SG_IES,
    state: row.SG_UF_IES,
    status: 'not_found_in_ror',
    rorId: null,
    rorWebsite: null,
    website: null,
    websiteSource: null,
    websiteReachable: false,
    websiteHttpStatus: null,
    websiteFinalHost: null,
    websiteErrorCode: null,
    websiteFailure: null,
    wordpressSearchApi: false,
    admissionApiHits: 0,
    rssFeed: false,
    sitemap: false,
    robotsStatus: null,
  };
  try {
    const response = await request(
      'https://api.ror.org/v2/organizations?query=' + encodeURIComponent(row.NO_IES),
    );
    if (!response.ok) {
      result.status = 'ror_unavailable';
      return result;
    }
    const data = await response.json();
    let matches = (data.items ?? []).filter(
      (item) =>
        item.locations?.some((place) => place.geonames_details?.country_code === 'BR') &&
        item.names?.some((name) => normalized(name.value ?? '') === normalized(row.NO_IES)),
    );
    let matchMethod = 'exact_name';
    const acronym = row.SG_IES.trim();
    if (matches.length === 0 && acronym.length >= 3) {
      const acronymResponse = await request(
        'https://api.ror.org/v2/organizations?query=' + encodeURIComponent(acronym),
      );
      if (acronymResponse.ok) {
        const acronymData = await acronymResponse.json();
        matches = (acronymData.items ?? []).filter(
          (item) =>
            item.locations?.some(
              (place) =>
                place.geonames_details?.country_code === 'BR' &&
                place.geonames_details?.country_subdivision_code === row.SG_UF_IES,
            ) && item.names?.some((name) => normalized(name.value ?? '') === normalized(acronym)),
        );
        matchMethod = 'acronym_and_state';
      }
    }
    if (matches.length !== 1) {
      result.status = matches.length ? 'ambiguous_ror_match' : 'not_found_in_ror';
      return result;
    }
    const match = matches[0];
    result.rorId = match.id;
    const site = match.links?.find((link) => link.type === 'website')?.value;
    if (!site) {
      result.status = 'ror_without_website';
      return result;
    }
    const parsed = new URL(site);
    if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname) {
      result.status = 'invalid_ror_website';
      return result;
    }
    result.rorWebsite = site;
    const correction = websiteCorrections[id];
    const homepage = new URL(correction?.url ?? site);
    if (
      homepage.username ||
      homepage.password ||
      !['http:', 'https:'].includes(homepage.protocol)
    ) {
      result.status = 'invalid_website_correction';
      return result;
    }
    homepage.protocol = 'https:';
    const siteCheck = await probe(homepage.toString(), '', 12000);
    result.website = homepage.toString();
    result.websiteSource = correction ? 'official_correction' : 'ror';
    result.websiteHttpStatus = siteCheck.status;
    result.websiteErrorCode = siteCheck.errorCode;
    const expectedHost = homepage.hostname.replace(/^www\./u, '');
    const actualHost = siteCheck.url ? new URL(siteCheck.url).hostname : '';
    result.websiteFinalHost = actualHost || null;
    result.websiteReachable =
      siteCheck.valid && (actualHost === expectedHost || actualHost.endsWith(`.${expectedHost}`));
    if (!result.websiteReachable) {
      result.websiteFailure =
        actualHost === 'validate.perfdrive.com'
          ? 'bot_challenge'
          : siteCheck.errorCode
            ? 'request_error'
            : siteCheck.status && siteCheck.status >= 400
              ? 'http_error'
              : actualHost && actualHost !== expectedHost
                ? 'off_domain_redirect'
                : 'unknown';
    }
    result.status = result.websiteReachable
      ? `ror_${matchMethod}_site_live`
      : `ror_${matchMethod}_site_unreachable`;
    if (!result.websiteReachable) return result;
    const origin = homepage.origin;
    const [api, rss, sitemap, robots] = await Promise.all([
      probe(origin + '/wp-json/wp/v2/search?search=ingresso&per_page=1', 'json'),
      probe(origin + '/feed/', 'xml'),
      probe(origin + '/sitemap.xml', 'xml'),
      probe(origin + '/robots.txt'),
    ]);
    result.wordpressSearchApi = api.valid;
    if (api.valid) result.admissionApiHits = await admissionApiHits(origin);
    result.rssFeed = rss.valid;
    result.sitemap = sitemap.valid;
    result.robotsStatus = robots.status;
  } catch {
    result.status = 'ror_lookup_failed';
  }
  return result;
}

const institutions = parseCsv(await readFile(input, 'utf8'));
if (institutions.length !== 317) throw new Error('Expected 317 public institutions');
const results = Array(institutions.length);
let cursor = 0;
let completed = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (cursor < institutions.length) {
      const index = cursor++;
      results[index] = await auditInstitution(institutions[index]);
      completed += 1;
      if (completed % 25 === 0 || completed === institutions.length) {
        console.log(`Audited ${completed}/${institutions.length}`);
      }
    }
  }),
);
const summary = results.reduce((counts, item) => {
  counts[item.status] = (counts[item.status] ?? 0) + 1;
  if (item.websiteFailure)
    counts[`failure_${item.websiteFailure}`] = (counts[`failure_${item.websiteFailure}`] ?? 0) + 1;
  if (item.websiteSource === 'official_correction')
    counts.officialCorrections = (counts.officialCorrections ?? 0) + 1;
  if (item.wordpressSearchApi) counts.wordpressSearchApi = (counts.wordpressSearchApi ?? 0) + 1;
  if (item.admissionApiHits) counts.admissionApiWithHits = (counts.admissionApiWithHits ?? 0) + 1;
  if (item.rssFeed) counts.rssFeed = (counts.rssFeed ?? 0) + 1;
  if (item.sitemap) counts.sitemap = (counts.sitemap ?? 0) + 1;
  return counts;
}, {});
await writeFile(
  output,
  JSON.stringify(
    {
      checkedOn,
      sources: {
        institutions: 'Inep Censo 2024',
        websites: 'https://api.ror.org/v2/organizations',
      },
      summary,
      institutions: results,
    },
    null,
    2,
  ) + '\n',
);
const columns = [
  'id',
  'name',
  'acronym',
  'state',
  'status',
  'rorId',
  'rorWebsite',
  'website',
  'websiteSource',
  'websiteReachable',
  'websiteHttpStatus',
  'websiteFinalHost',
  'websiteErrorCode',
  'websiteFailure',
  'wordpressSearchApi',
  'admissionApiHits',
  'rssFeed',
  'sitemap',
  'robotsStatus',
];
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
await writeFile(
  csvOutput,
  '\ufeff' +
    [
      columns.join(','),
      ...results.map((item) => columns.map((column) => csvCell(item[column])).join(',')),
    ].join('\n') +
    '\n',
);
console.log(JSON.stringify(summary));
