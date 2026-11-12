import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminReviewApiService } from './admin-review-api.service';
import { ProcessingReviewWorkspace } from './processing-review-workspace';
import type { ProcessingReviewItem } from './review.types';

const institution = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Universidade de teste',
  acronym: 'UT',
};
const item: ProcessingReviewItem = {
  id: '11111111-1111-4111-8111-111111111111',
  sha256: 'a'.repeat(64),
  status: 'OPEN',
  reviewVersion: 4,
  createdAt: '2026-11-12T12:00:00.000Z',
  document: {
    id: '33333333-3333-4333-8333-333333333333',
    url: 'https://www.example.edu.br/editais/2026',
    mediaType: 'application/pdf',
    version: 1,
    capturedAt: '2026-11-11T12:00:00.000Z',
    processingResults: [
      {
        processorKind: 'CLASSIFICATION',
        schemaVersion: 1,
        status: 'PENDING_REVIEW',
        resultJson: { result: null, reason: 'connector disabled' },
        createdAt: '2026-11-12T12:00:00.000Z',
      },
    ],
  },
  discoveredUrl: {
    id: '44444444-4444-4444-8444-444444444444',
    canonicalUrl: 'https://www.example.edu.br/editais/2026',
  },
  eligibleInstitutions: [institution],
};

describe('processing review workspace', () => {
  it('shows immutable results and creates a draft only after curator action', async () => {
    const api = {
      listProcessingArtifacts: vi.fn().mockResolvedValue({
        data: [item],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
      processingProcessOptions: vi.fn().mockResolvedValue([]),
      resolveProcessingArtifact: vi.fn().mockResolvedValue({
        id: item.id,
        status: 'RESOLVED',
        processId: 'process-id',
        reviewVersion: 5,
      }),
    };
    await TestBed.configureTestingModule({
      imports: [ProcessingReviewWorkspace],
      providers: [{ provide: AdminReviewApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProcessingReviewWorkspace);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    await fixture.componentInstance.open(item);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('CLASSIFICATION');
    expect(api.resolveProcessingArtifact).not.toHaveBeenCalled();

    fixture.componentInstance.reason.set('Revisar a fonte e decidir os próximos dados.');
    await fixture.componentInstance.resolve();
    expect(api.resolveProcessingArtifact).toHaveBeenCalledWith(item.id, {
      expectedReviewVersion: 4,
      institutionId: institution.id,
      reason: 'Revisar a fonte e decidir os próximos dados.',
    });
    expect(fixture.componentInstance.message()).toContain('Rascunho criado');
  });
});
