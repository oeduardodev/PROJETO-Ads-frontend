import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminSessionService } from '../admin-session.service';
import { AdminReviewApiService } from './admin-review-api.service';
import { AdminReviewWorkspace } from './admin-review-workspace';
import type {
  AdminProcessDetail,
  AdminReviewQueueResponse,
  ReviewCommandResult,
} from './review.types';

const processId = '11111111-1111-4111-8111-111111111111';
const evidenceId = '22222222-2222-4222-8222-222222222222';

const queue: AdminReviewQueueResponse = {
  data: [
    {
      id: processId,
      noticeCode: 'EDITAL-01',
      noticeYear: 2026,
      ingestionState: 'NEEDS_REVIEW',
      publicationStatus: 'EM_REVISAO',
      reviewVersion: 7,
      createdAt: '2026-11-01T12:00:00.000Z',
      institution: { id: 'ufpb', name: 'Universidade Federal da Paraíba', acronym: 'UFPB' },
      _count: { offerings: 1, evidence: 1, revisions: 0 },
    },
  ],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

const detail: AdminProcessDetail = {
  id: processId,
  institutionId: 'ufpb',
  institution: { id: 'ufpb', name: 'Universidade Federal da Paraíba', acronym: 'UFPB' },
  noticeCode: 'EDITAL-01',
  noticeYear: 2026,
  selectionType: 'Vagas remanescentes',
  regularSisuFlow: false,
  requiresEnem: true,
  tuitionFree: true,
  demoHistorical: false,
  referenceUrl: 'https://prg.ufpb.br/edital-01',
  verifiedAt: null,
  ingestionState: 'NEEDS_REVIEW',
  ingestionStateReason: 'Conferência humana necessária',
  publicationStatus: 'EM_REVISAO',
  reviewVersion: 7,
  createdAt: '2026-11-01T12:00:00.000Z',
  offerings: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      courseName: 'Engenharia',
      degreeType: 'Bacharelado',
      modality: 'Presencial',
      shift: 'Integral',
      seats: 2,
      campusId: null,
      reservations: [],
    },
  ],
  windows: [],
  requirements: [],
  evidence: [
    {
      id: evidenceId,
      fieldPath: 'noticeCode',
      pageOrSection: 'p. 1',
      quote: 'EDITAL-01 — seleção de vagas remanescentes',
      document: {
        id: '44444444-4444-4444-8444-444444444444',
        url: 'https://prg.ufpb.br/edital-01.pdf',
        sha256: 'a'.repeat(64),
        mediaType: 'application/pdf',
        version: 1,
        capturedAt: '2026-11-01T12:00:00.000Z',
        issuedAt: '2026-10-30T12:00:00.000Z',
      },
    },
  ],
  revisions: [],
  reviewDecisions: [],
};

describe('admin editorial review workspace', () => {
  async function setup() {
    const api = {
      list: vi.fn().mockResolvedValue(queue),
      get: vi.fn().mockResolvedValue(detail),
      approve: vi.fn().mockResolvedValue({
        processId,
        ingestionState: 'VERIFIED',
        publicationStatus: 'PUBLICADO',
        reviewVersion: 8,
      } satisfies ReviewCommandResult),
      reject: vi.fn(),
      correct: vi.fn(),
    };
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [AdminReviewWorkspace],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: processId })) },
        },
        { provide: AdminSessionService, useValue: { signOut: vi.fn() } },
        { provide: AdminReviewApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminReviewWorkspace);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, router };
  }

  it('shows extracted facts beside their source evidence and keeps approval gated', async () => {
    const { fixture } = await setup();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Engenharia');
    expect(page.textContent).toContain('EDITAL-01 — seleção de vagas remanescentes');
    expect(page.textContent).toContain('p. 1');
    expect(page.querySelector<HTMLButtonElement>('.review-button--lime')?.disabled).toBe(true);
  });

  it('submits the current review version, reason, evidence, and scope attestations', async () => {
    const { fixture, api, router } = await setup();
    const component = fixture.componentInstance;
    component.reason.set('Conferido no edital oficial.');
    component.toggleEvidence(evidenceId, true);
    component.scopeEligible.set(true);
    component.criticalFactsClear.set(true);

    expect(component.canApprove()).toBe(true);
    await component.approve();

    expect(api.approve).toHaveBeenCalledWith(processId, {
      expectedReviewVersion: 7,
      reason: 'Conferido no edital oficial.',
      evidenceIds: [evidenceId],
      scopeEligible: true,
      unresolvedCriticalFacts: false,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/reviews'], { replaceUrl: true });
  });

  it('keeps historical demo records out of the approval path', async () => {
    const { fixture, api } = await setup();
    const component = fixture.componentInstance;
    component.detail.set({ ...detail, demoHistorical: true });
    component.reason.set('Revisado.');
    component.toggleEvidence(evidenceId, true);
    component.scopeEligible.set(true);
    component.criticalFactsClear.set(true);

    expect(component.canApprove()).toBe(false);
    await component.approve();
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('flags a stale version and requires an explicit reload after a 409', async () => {
    const { fixture, api } = await setup();
    const component = fixture.componentInstance;
    component.reason.set('Conferido no edital oficial.');
    component.toggleEvidence(evidenceId, true);
    component.scopeEligible.set(true);
    component.criticalFactsClear.set(true);
    api.approve.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));

    await component.approve();

    expect(component.stale()).toBe(true);
    expect(component.actionError()).toContain('mudou desde que foi aberto');
    expect(api.approve).toHaveBeenCalledTimes(1);
  });
});
