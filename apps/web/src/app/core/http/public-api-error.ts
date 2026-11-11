export type PublicApiErrorKind = 'timeout' | 'cancelled' | 'network' | 'server' | 'http';

export class PublicApiError extends Error {
  constructor(
    readonly kind: PublicApiErrorKind,
    message: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'PublicApiError';
  }

  get retryable(): boolean {
    return ['timeout', 'network', 'server'].includes(this.kind);
  }
}
