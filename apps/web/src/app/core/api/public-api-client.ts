import { createClient } from './generated/client';
import type { Client } from './generated/client';
import type { ApiError } from './generated/types.gen';
import { PublicApiError } from '../http/public-api-error';

export const DEFAULT_PUBLIC_API_TIMEOUT_MS = 8_000;

export function resolvePublicApiBaseUrl(configuredUrl: string, fallbackOrigin = ''): string {
  const candidate = configuredUrl.trim() || fallbackOrigin.trim();
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('Invalid API origin');
    }
    return parsed.toString().replace(/\/$/u, '');
  } catch {
    throw new Error('Public API base URL must be an HTTP(S) origin without credentials or path.');
  }
}

function apiErrorPayload(error: unknown): ApiError | null {
  if (!error || typeof error !== 'object' || !('error' in error)) return null;
  const payload = (error as { error?: unknown }).error;
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Partial<ApiError['error']>;
  if (
    typeof candidate.code !== 'string' ||
    typeof candidate.message !== 'string' ||
    typeof candidate.status !== 'number' ||
    typeof candidate.requestId !== 'string'
  ) {
    return null;
  }
  return { error: candidate as ApiError['error'] };
}

export function createPublicApiClient(
  baseUrl: string,
  fetcher: typeof fetch = globalThis.fetch,
  timeoutMs = DEFAULT_PUBLIC_API_TIMEOUT_MS,
): Client {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('Public API timeout must be a positive integer.');
  }
  const client = createClient({
    baseUrl,
    throwOnError: true,
    fetch: async (request, init) => {
      const controller = new AbortController();
      const sourceSignal =
        init?.signal ?? (request instanceof Request ? request.signal : undefined);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const cancelWithCaller = () => controller.abort();
      if (sourceSignal?.aborted) controller.abort();
      else sourceSignal?.addEventListener('abort', cancelWithCaller, { once: true });
      try {
        return await fetcher(request, { ...init, signal: controller.signal });
      } catch (error) {
        if (timedOut) {
          throw new PublicApiError('timeout', 'O serviço demorou para responder. Tente novamente.');
        }
        throw error;
      } finally {
        clearTimeout(timer);
        sourceSignal?.removeEventListener('abort', cancelWithCaller);
      }
    },
  });

  client.interceptors.error.use((error, response, request) => {
    if (error instanceof PublicApiError) return error;
    if (request?.signal.aborted) {
      return new PublicApiError('cancelled', 'A solicitação foi cancelada.');
    }
    const payload = apiErrorPayload(error);
    const status = response?.status ?? payload?.error.status;
    if (status !== undefined && status >= 500) {
      return new PublicApiError(
        'server',
        'O serviço está temporariamente indisponível. Tente novamente.',
        status,
        payload?.error.requestId,
      );
    }
    if (status !== undefined) {
      return new PublicApiError(
        'http',
        payload?.error.message ?? 'Não foi possível concluir esta solicitação.',
        status,
        payload?.error.requestId,
      );
    }
    return new PublicApiError(
      'network',
      'Não foi possível conectar ao serviço. Verifique sua conexão.',
    );
  });
  return client;
}
