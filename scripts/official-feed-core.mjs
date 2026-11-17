export const CATEGORIES = [
  'Reopção',
  'Transferência',
  'Ingresso de graduados',
  'Processo Seletivo Especial',
];

export async function fetchWithBackoff(
  fetcher,
  wait = (ms) => new Promise((done) => setTimeout(done, ms)),
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetcher();
      if (![429, 502, 503, 504].includes(response.status) || attempt === 2) return response;
    } catch (error) {
      if (attempt === 2 || !['AbortError', 'TimeoutError', 'TypeError'].includes(error?.name)) {
        throw error;
      }
    }
    await wait(400 * 2 ** attempt);
  }
  throw new Error('UNREACHABLE_RETRY_STATE');
}

export function robotsAllowsPath(content, path, userAgent = 'AlemDoSiSU-OfficialFeed/1.0') {
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const raw of content.split(/\r?\n/gu)) {
    const line = raw.split('#', 1)[0].trim();
    if (!line) {
      flush();
      continue;
    }
    const delimiter = line.indexOf(':');
    if (delimiter < 0) continue;
    const field = line.slice(0, delimiter).trim().toLowerCase();
    const value = line.slice(delimiter + 1).trim();
    if (field === 'user-agent') {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if (agents.length && (field === 'allow' || field === 'disallow')) {
      rules.push({ field, value });
    }
  }
  flush();

  const agent = userAgent.toLowerCase();
  const matching = groups.flatMap((group) =>
    group.agents
      .filter((value) => value === '*' || agent.startsWith(value))
      .map((value) => ({ specificity: value === '*' ? 0 : value.length, rules: group.rules })),
  );
  if (!matching.length) return true;
  const specificity = Math.max(...matching.map((group) => group.specificity));
  let best = { specificity: -1, allow: true };
  for (const group of matching.filter((item) => item.specificity === specificity)) {
    for (const rule of group.rules) {
      if (!rule.value) continue;
      const anchored = rule.value.endsWith('$');
      const pattern = anchored ? rule.value.slice(0, -1) : rule.value;
      const escaped = pattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
        .join('.*');
      if (!new RegExp(`^${escaped}${anchored ? '$' : ''}`, 'u').test(path)) continue;
      const ruleSpecificity = pattern.replaceAll('*', '').length;
      if (
        ruleSpecificity > best.specificity ||
        (ruleSpecificity === best.specificity && rule.field === 'allow')
      ) {
        best = { specificity: ruleSpecificity, allow: rule.field === 'allow' };
      }
    }
  }
  return best.allow;
}

export function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function plainText(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(
      /&(amp|quot|apos|lt|gt|nbsp);/giu,
      (_, name) =>
        ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' })[name.toLowerCase()],
    )
    .replace(/\s+/gu, ' ')
    .trim();
}

export function officialUrl(value, sourceUrl) {
  try {
    const source = new URL(sourceUrl);
    const target = new URL(value, source);
    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password ||
      target.port ||
      target.hostname !== source.hostname
    ) {
      return null;
    }
    target.hash = '';
    for (const key of [...target.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/iu.test(key)) target.searchParams.delete(key);
    }
    return target.toString();
  } catch {
    return null;
  }
}

export function classifyCandidate(title, url, currentYear = new Date().getFullYear()) {
  const headline = normalize(plainText(title));
  const path = normalize(new URL(url).pathname);
  const text = `${headline} ${path}`;
  if (
    /resultado|classific|convoc|homolog|recurso|isenc|gabarito|lista de espera|chamada|aprovad|matricula|cadastramento|temas para prova|retificacao de resultado/u.test(
      headline,
    ) ||
    /servidor|docente|professor|concurso publico/u.test(headline) ||
    /pos graduacao|mestrado|doutorado|especializacao|residencia|dinter|pre vestibular|preparatorio|cursos livres|idiomas?|creche|bolsa|bolsist|estagio|assistencia estudantil|proeja|cursos? tecnic|ensino medio|pet saude|peti/u.test(
      text,
    ) ||
    /\bsisu\b|sistema de selecao unificada/u.test(text)
  ) {
    return null;
  }
  const years = [...text.matchAll(/20\d{2}/gu)].map((match) => Number(match[0]));
  if (years.length && Math.max(...years) < currentYear) return null;
  let category;
  if (/reopcao|mudanca de curso|mudanca interna de curso/u.test(text)) {
    category = 'Reopção';
  } else if (
    /transferencia (externa|voluntaria|facultativa|de curso)|transferencia para graduacao|transferencia facultativa/u.test(
      text,
    )
  ) {
    category = 'Transferência';
  } else if (
    /ingresso de graduad|portador(?:es)? de diploma|segunda graduacao|novo curso superior/u.test(
      text,
    )
  ) {
    category = 'Ingresso de graduados';
  } else if (
    /vagas (remanescentes|residuais|ociosas)|reocupacao de vagas|processo seletivo especial|selecao especial|entradas derivadas|mobilidade academica/u.test(
      text,
    )
  ) {
    category = 'Processo Seletivo Especial';
  } else {
    return null;
  }
  return {
    category,
    pageKind:
      /^edital\b/u.test(headline) || /\.pdf$/iu.test(new URL(url).pathname)
        ? 'edital'
        : 'selection_page',
  };
}

export function parseHtmlCandidates(html, sourceUrl) {
  const candidates = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu,
  )) {
    const url = officialUrl(match[1], sourceUrl);
    const title = plainText(match[2]);
    if (url && title.length >= 8) candidates.push({ title, url });
  }
  return candidates;
}

export function parseRssCandidates(xml, sourceUrl) {
  const candidates = [];
  for (const match of xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/giu)) {
    const body = match[2];
    const title = plainText(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? '');
    const link =
      body.match(/<link\b[^>]*href=["']([^"']+)["']/iu)?.[1] ??
      body.match(/<link\b[^>]*>([\s\S]*?)<\/link>/iu)?.[1] ??
      '';
    const url = officialUrl(plainText(link), sourceUrl);
    if (url && title.length >= 8) candidates.push({ title, url });
  }
  return candidates;
}

export function parseSitemapCandidates(xml, sourceUrl) {
  const candidates = [];
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/giu)) {
    const url = officialUrl(plainText(match[1]), sourceUrl);
    if (!url) continue;
    let slug;
    try {
      slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '')
        .replace(/\.pdf$/iu, '')
        .replace(/[-_]+/gu, ' ');
    } catch {
      continue;
    }
    if (slug.length >= 8) candidates.push({ title: slug, url });
  }
  return candidates;
}

export function validatedItems(candidates, source, checkedAt) {
  const result = new Map();
  for (const candidate of candidates) {
    const url = officialUrl(candidate.url, source.url);
    if (!url) continue;
    const title = plainText(candidate.title).slice(0, 220);
    const classification = classifyCandidate(title, url);
    if (!classification || title.length < 8) continue;
    result.set(url, {
      institutionId: source.institutionId,
      institution: source.acronym,
      state: source.state,
      title,
      url,
      category: classification.category,
      pageKind: classification.pageKind,
      sourceUrl: source.url,
      checkedAt,
    });
  }
  return [...result.values()].slice(0, 40);
}
