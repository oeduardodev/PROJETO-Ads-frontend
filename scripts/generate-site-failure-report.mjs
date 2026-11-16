import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const data = resolve(root, 'data/inep');
const [initial, systemCa, audit, corrections] = await Promise.all([
  readFile(resolve(data, 'unreachable-site-diagnostics-node-default.json'), 'utf8').then(
    JSON.parse,
  ),
  readFile(resolve(data, 'unreachable-site-diagnostics.json'), 'utf8').then(JSON.parse),
  readFile(resolve(data, 'institution-source-audit.json'), 'utf8').then(JSON.parse),
  readFile(resolve(data, 'official-website-corrections.json'), 'utf8').then(JSON.parse),
]);
const byId = new Map(audit.institutions.map((item) => [item.id, item]));
const systemById = new Map(systemCa.institutions.map((item) => [item.id, item]));

function diagnosis(first, second) {
  const oldProbe = first.probes.rorUrl;
  const current = second.probes.rorUrl;
  if (current.finalUrl?.startsWith('https://validate.perfdrive.com/')) {
    return 'desafio_antibot';
  }
  if (current.causeCode === 'CERT_HAS_EXPIRED') return 'certificado_expirado';
  if (current.causeCode === 'ERR_TLS_CERT_ALTNAME_INVALID') return 'certificado_dominio_incorreto';
  if (current.status === 403) return 'http_403_neste_cliente';
  if (current.status === 500) return 'http_500';
  if (current.status === 404) return 'url_antiga_http_404';
  if (
    oldProbe.causeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' &&
    current.status >= 200 &&
    current.status < 400
  ) {
    return 'loja_certificados_node';
  }
  if (current.status >= 200 && current.status < 400) {
    const originalHost = new URL(first.website).hostname.replace(/^www\./u, '');
    const finalHost = new URL(current.finalUrl).hostname;
    if (finalHost !== originalHost && !finalHost.endsWith(`.${originalHost}`)) {
      return 'redirecionamento_outro_dominio';
    }
    return 'falha_transitoria_ou_timeout_curto';
  }
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(current.causeCode)) return 'dns_neste_ambiente';
  if (current.causeCode === 'ECONNREFUSED') return 'conexao_recusada_neste_ambiente';
  if (current.causeCode === 'ECONNRESET') return 'conexao_reiniciada_neste_ambiente';
  if (current.causeCode || current.error) return 'timeout_ou_conectividade_neste_ambiente';
  return 'causa_nao_confirmada';
}

const rows = initial.institutions.map((first) => {
  const second = systemById.get(first.id);
  const current = byId.get(first.id);
  if (!second || !current) throw new Error(`Missing diagnostics for ${first.id}`);
  const correction = corrections[first.id];
  return {
    id: first.id,
    acronym: first.acronym,
    name: first.name,
    state: first.state,
    originalRorUrl: first.website,
    diagnosis: diagnosis(first, second),
    initialHttpStatus: first.probes.rorUrl.status,
    initialErrorCode: first.probes.rorUrl.causeCode ?? first.probes.rorUrl.error ?? null,
    systemCaHttpStatus: second.probes.rorUrl.status,
    systemCaErrorCode: second.probes.rorUrl.causeCode ?? second.probes.rorUrl.error ?? null,
    systemCaFinalHost: second.probes.rorUrl.finalUrl
      ? new URL(second.probes.rorUrl.finalUrl).hostname
      : null,
    correctedUrl: correction?.url ?? null,
    correctionEvidence: correction?.evidence ?? null,
    currentUrl: current.website,
    currentStatus: current.status,
    currentReachableByWorker: current.websiteReachable,
    currentHttpStatus: current.websiteHttpStatus,
    currentErrorCode: current.websiteErrorCode,
    currentFailure: current.websiteFailure,
  };
});
if (rows.length !== 43 || new Set(rows.map((row) => row.id)).size !== 43) {
  throw new Error('Expected 43 unique initial failures');
}
const columns = Object.keys(rows[0]);
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
await writeFile(
  resolve(data, 'unreachable-site-cases.csv'),
  '\ufeff' +
    [
      columns.join(','),
      ...rows.map((item) => columns.map((column) => csvCell(item[column])).join(',')),
    ].join('\n') +
    '\n',
);
const counts = rows.reduce((result, item) => {
  result[item.diagnosis] = (result[item.diagnosis] ?? 0) + 1;
  return result;
}, {});
console.log(
  JSON.stringify({
    checked: rows.length,
    nowReachable: rows.filter((x) => x.currentReachableByWorker).length,
    diagnoses: counts,
  }),
);
