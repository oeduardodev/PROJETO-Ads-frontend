export interface AdminSource {
  id: string;
  institutionId: string;
  allowedDomainId: string;
  url: string;
  kind: string;
  frequencyMinutes: number;
  priority: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | string;
  health: 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'BLOCKED' | string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  allowedDomain: { host: string; collectionAllowed: boolean; reviewedAt: string | null };
}

export interface AdminSourceDetail extends AdminSource {
  allowedDomain: AdminSource['allowedDomain'] & {
    evidenceUrl: string;
    officialSourceVerified: boolean;
    accessPolicyReviewed: boolean;
  };
  crawlRuns: Array<{
    id: string;
    startedAt: string;
    finishedAt: string | null;
    attempt: number;
    status: string;
    httpStatus: number | null;
    success: boolean | null;
    errorCode: string | null;
  }>;
  backoff: {
    active: boolean;
    jobId: string | null;
    attemptsMade: number;
    retryDelayMs: number | null;
    nextRetryAt: string | null;
  };
  candidateCount: number;
  sourceRefreshQueue: Partial<
    Record<'waiting' | 'active' | 'delayed' | 'failed' | 'completed' | 'paused', number>
  >;
  searchQuota: { host: string; dayUTC: string; limit: number; used: number; remaining: number };
}

export interface ManualSourceRunResult {
  sourceId: string;
  jobId: string;
  state: 'queued' | string;
}
