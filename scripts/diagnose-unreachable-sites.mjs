import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const audit = JSON.parse(
  await readFile(resolve(root, 'data/inep/institution-source-audit.json'), 'utf8'),
);
const targets = audit.institutions.filter((item) => item.status.endsWith('_site_unreachable'));
const results = Array(targets.length);

async function probe(url, userAgent) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml' },
    });
    await response.body?.cancel().catch(() => undefined);
    const final = new URL(response.url);
    return {
      status: response.status,
      finalUrl:
        final.hostname === 'validate.perfdrive.com' ? final.origin + final.pathname : response.url,
      contentType: response.headers.get('content-type'),
      server: response.headers.get('server'),
    };
  } catch (error) {
    const cause = error.cause;
    return {
      error: error.name,
      message: error.message,
      causeCode: cause?.code ?? null,
      causeMessage: cause?.message ?? null,
    };
  }
}

let cursor = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < targets.length) {
      const index = cursor++;
      const item = targets[index];
      const original = new URL(item.website);
      const variants = new Map([
        ['rorUrl', original.toString()],
        ['origin', original.origin + '/'],
      ]);
      const alternate = new URL(original.origin);
      alternate.hostname = alternate.hostname.startsWith('www.')
        ? alternate.hostname.slice(4)
        : `www.${alternate.hostname}`;
      variants.set('alternateHost', alternate.toString());
      const probes = Object.fromEntries(
        await Promise.all(
          [...variants].map(async ([label, url]) => [
            label,
            await probe(url, 'AlemDoSiSU-Source-Audit/1.0'),
          ]),
        ),
      );
      if (!probes.rorUrl?.status || probes.rorUrl.status >= 400) {
        probes.browserUserAgent = await probe(
          original.toString(),
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        );
      }
      results[index] = {
        id: item.id,
        acronym: item.acronym,
        name: item.name,
        state: item.state,
        rorId: item.rorId,
        website: item.website,
        probes,
      };
      console.log(`${index + 1}/${targets.length}: ${item.acronym}`);
    }
  }),
);
const output = resolve(root, 'data/inep/unreachable-site-diagnostics.json');
await writeFile(
  output,
  JSON.stringify(
    {
      checkedOn: new Date().toISOString(),
      nodeSystemCa: process.execArgv.includes('--use-system-ca'),
      institutions: results,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Wrote ${results.length} diagnostics to ${output}`);
