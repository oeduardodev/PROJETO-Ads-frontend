export interface AdminReviewQueueItem {
  id: string;
  noticeCode: string | null;
  noticeYear: number | null;
  ingestionState: string;
  publicationStatus: string;
  reviewVersion: number;
  createdAt: string;
  institution: { id: string; name: string; acronym: string };
  _count: { offerings: number; evidence: number; revisions: number };
}

export interface AdminReviewQueueResponse {
  data: AdminReviewQueueItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ReviewEvidence {
  id: string;
  fieldPath: string;
  pageOrSection: string | null;
  quote: string;
  document: {
    id: string;
    url: string;
    sha256: string;
    mediaType: string;
    version: number;
    capturedAt: string;
    issuedAt: string | null;
  };
}

export interface AdminProcessDetail {
  id: string;
  institutionId: string;
  institution: { id: string; name: string; acronym: string };
  noticeCode: string | null;
  noticeYear: number | null;
  selectionType: string | null;
  regularSisuFlow: boolean | null;
  requiresEnem: boolean | null;
  tuitionFree: boolean | null;
  demoHistorical: boolean;
  referenceUrl: string | null;
  verifiedAt: string | null;
  ingestionState: string;
  ingestionStateReason: string | null;
  publicationStatus: string;
  reviewVersion: number;
  createdAt: string;
  offerings: Array<{
    id: string;
    courseName: string;
    degreeType: string | null;
    modality: string | null;
    shift: string | null;
    seats: number | null;
    campusId: string | null;
    reservations: Array<{ id: string; category: string; seats: number | null }>;
  }>;
  windows: Array<{
    id: string;
    label: string | null;
    startDate: string | null;
    startTime: string | null;
    endDate: string | null;
    endTime: string | null;
    timezone: string | null;
    instructionsUrl: string | null;
  }>;
  requirements: Array<{
    id: string;
    criterion: string;
    required: boolean | null;
    valueJson: unknown;
  }>;
  evidence: ReviewEvidence[];
  revisions: Array<{
    id: string;
    detectedAt: string;
    document: { id: string; url: string; sha256: string; version: number; capturedAt: string };
  }>;
  reviewDecisions: Array<{
    id: string;
    decision: string;
    reason: string;
    reviewedAt: string;
  }>;
}

export interface ReviewCorrectionPatch {
  target: 'process' | 'offering' | 'window' | 'requirement' | 'reservation';
  targetId?: string;
  field: string;
  value: unknown;
  evidenceId: string;
}

export interface ReviewCommandResult {
  processId: string;
  ingestionState: string;
  publicationStatus: string;
  reviewVersion: number;
}

export interface ProcessingReviewInstitution {
  id: string;
  name: string;
  acronym: string;
}

export interface ProcessingReviewItem {
  id: string;
  sha256: string;
  status: 'OPEN' | 'RESOLVED';
  reviewVersion: number;
  createdAt: string;
  document: {
    id: string;
    url: string;
    mediaType: string;
    version: number;
    capturedAt: string;
    processingResults: Array<{
      processorKind: string;
      schemaVersion: number;
      status: string;
      resultJson: unknown;
      createdAt: string;
    }>;
  };
  discoveredUrl: { id: string; canonicalUrl: string } | null;
  eligibleInstitutions: ProcessingReviewInstitution[];
}

export interface ProcessingReviewQueueResponse {
  data: ProcessingReviewItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ProcessingReviewProcessOption {
  id: string;
  institutionId: string;
  noticeCode: string | null;
  noticeYear: number | null;
  institution: { acronym: string; name: string };
}
