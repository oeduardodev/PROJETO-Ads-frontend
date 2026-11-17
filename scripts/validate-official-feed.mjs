import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CATEGORIES, officialUrl } from './official-feed-core.mjs';

const root = resolve(import.meta.dirname, '..');
const feed = JSON.parse(
  await readFile(resolve(root, 'apps/web/public/official-feed.json'), 'utf8'),
);
const audit = JSON.parse(
  await readFile(resolve(root, 'data/inep/institution-source-audit.json'), 'utf8'),
);
const institutions = new Map(audit.institutions.map((item) => [item.id, item]));
const sources = new Map(feed.sources?.map((source) => [source.key, source]));
const urls = new Set();

if (feed.version !== 1 || !Array.isArray(feed.items) || !Array.isArray(feed.sources)) {
  throw new Error('Invalid feed structure');
}
if (feed.sourceCount !== feed.sources.length || !Number.isFinite(Date.parse(feed.checkedAt))) {
  throw new Error('Invalid feed metadata');
}
if (feed.items.length === 0 || sources.size !== feed.sources.length) {
  throw new Error('Empty feed or duplicate source key');
}
for (const item of feed.items) {
  const institution = institutions.get(item.institutionId);
  const source = sources.get(item.sourceKey);
  if (
    !institution ||
    !source ||
    source.institutionId !== item.institutionId ||
    item.institution !== institution.acronym ||
    item.state !== institution.state ||
    item.sourceUrl !== source.url ||
    !CATEGORIES.includes(item.category) ||
    !['edital', 'selection_page'].includes(item.pageKind) ||
    typeof item.title !== 'string' ||
    item.title.length < 8 ||
    !Number.isFinite(Date.parse(item.discoveredAt)) ||
    !Number.isFinite(Date.parse(item.checkedAt)) ||
    officialUrl(item.url, source.url) !== item.url ||
    urls.has(item.url)
  ) {
    throw new Error(`Invalid official feed item: ${item.sourceKey ?? 'unknown source'}`);
  }
  urls.add(item.url);
}
const checkedAt = feed.items.map((item) => item.checkedAt).sort();
console.log(
  JSON.stringify({
    items: feed.items.length,
    sources: feed.sources.length,
    institutions: new Set(feed.items.map((item) => item.institutionId)).size,
    states: new Set(feed.items.map((item) => item.state)).size,
    sourceErrors: feed.sources.filter((source) => source.error).length,
    oldestItemCheckedAt: checkedAt[0],
  }),
);
