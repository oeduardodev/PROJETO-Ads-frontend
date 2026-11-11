import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_ENVIRONMENT } from '../public-environment';
import { createPublicApiClient, resolvePublicApiBaseUrl } from './public-api-client';
import { PublicCatalogService } from './public-catalog.service';
import { searchProcesses } from './generated';
import type { InstitutionList, ProcessList } from './generated';

const emptyList: ProcessList = {
  data: [],
  meta: { page: 1, pageSize: 25, total: 0 },
};
const emptyInstitutions: InstitutionList = {
  data: [],
  meta: { page: 1, pageSize: 25, total: 0 },
};

function configureService(): PublicCatalogService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PUBLIC_ENVIRONMENT,
        useValue: {
          apiBaseUrl: 'https://api.example.test',
          publicSiteUrl: 'https://web.example.test',
          catalogEnabled: true,
          adminOidc: null,
        },
      },
    ],
  });
  return TestBed.inject(PublicCatalogService);
}

describe('generated public API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves an environment origin and calls the generated process contract', async () => {
    expect(resolvePublicApiBaseUrl('', 'https://web.example.test/')).toBe(
      'https://web.example.test',
    );
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(emptyList, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await configureService().search({ q: 'Engenharia', page: 2 });

    expect(result).toEqual(emptyList);
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    const url = new URL(request.url);
    expect(url.origin).toBe('https://api.example.test');
    expect(url.pathname).toBe('/api/v1/processes');
    expect(url.searchParams.get('q')).toBe('Engenharia');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('normalizes 5xx responses into a retryable, non-sensitive error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        Response.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Database password leaked by a bad server',
              status: 503,
              requestId: 'request-503',
            },
          },
          { status: 503 },
        ),
      ),
    );

    await expect(configureService().search()).rejects.toMatchObject({
      kind: 'server',
      status: 503,
      requestId: 'request-503',
      retryable: true,
      message: 'O serviço está temporariamente indisponível. Tente novamente.',
    });
  });

  it('sends institution filters through the generated public contract', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(emptyInstitutions));
    vi.stubGlobal('fetch', fetchMock);

    await configureService().institutions({
      page: 2,
      page_size: 25,
      q: 'Paraíba',
      uf: 'PB',
      city: 'João Pessoa',
      jurisdiction: 'FEDERAL',
    });

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    const url = new URL(request.url);
    expect(url.pathname).toBe('/api/v1/institutions');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('q')).toBe('Paraíba');
    expect(url.searchParams.get('uf')).toBe('PB');
    expect(url.searchParams.get('city')).toBe('João Pessoa');
    expect(url.searchParams.get('jurisdiction')).toBe('FEDERAL');
  });

  it('turns a timed out generated request into a recoverable error', async () => {
    const client = createPublicApiClient(
      'https://api.example.test',
      (_request, init) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort, { once: true });
        }),
      2,
    );

    await expect(searchProcesses({ client, throwOnError: true })).rejects.toMatchObject({
      kind: 'timeout',
      retryable: true,
    });
  });

  it('preserves caller cancellation as a non-retryable cancellation state', async () => {
    const client = createPublicApiClient(
      'https://api.example.test',
      (_request, init) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort, { once: true });
        }),
      500,
    );
    const controller = new AbortController();
    const pending = searchProcesses({ client, signal: controller.signal, throwOnError: true });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ kind: 'cancelled', retryable: false });
  });

  it('rejects unsafe API origins rather than silently sending credentials or paths', () => {
    expect(() => resolvePublicApiBaseUrl('https://user:password@api.example.test')).toThrow(
      'Public API base URL must be an HTTP(S) origin without credentials or path.',
    );
    expect(() => resolvePublicApiBaseUrl('https://api.example.test/v1')).toThrow(
      'Public API base URL must be an HTTP(S) origin without credentials or path.',
    );
    expect(() => resolvePublicApiBaseUrl('javascript:alert(1)')).toThrow();
  });
});
