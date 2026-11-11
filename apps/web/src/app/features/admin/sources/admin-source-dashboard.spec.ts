import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AdminSessionService } from '../admin-session.service';
import { AdminSourceApiService } from './admin-source-api.service';
import { AdminSourceDashboard } from './admin-source-dashboard';
import type { AdminSource, AdminSourceDetail } from './source.types';

const sourceId = '11111111-1111-4111-8111-111111111111';
const source: AdminSource = {
  id: sourceId,
  institutionId: '22222222-2222-4222-8222-222222222222',
  allowedDomainId: '33333333-3333-4333-8333-333333333333',
  url: 'https://prg.example.edu/notices',
  kind: 'HTML_INDEX',
  frequencyMinutes: 240,
  priority: 10,
  status: 'ACTIVE',
  health: 'DEGRADED',
  lastCheckedAt: '2026-11-10T12:00:00.000Z',
  lastSuccessAt: '2026-11-09T12:00:00.000Z',
  allowedDomain: {
    host: 'prg.example.edu',
    collectionAllowed: true,
    reviewedAt: '2026-11-01T12:00:00.000Z',
  },
};
const detail: AdminSourceDetail = {
  ...source,
  allowedDomain: {
    ...source.allowedDomain,
    evidenceUrl: 'https://prg.example.edu/policy',
    officialSourceVerified: true,
    accessPolicyReviewed: true,
  },
  crawlRuns: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      startedAt: '2026-11-10T12:00:00.000Z',
      finishedAt: '2026-11-10T12:00:04.000Z',
      attempt: 2,
      status: 'FAILED',
      httpStatus: 503,
      success: false,
      errorCode: 'HTTP_5XX',
    },
  ],
  backoff: {
    active: true,
    jobId: 'source-refresh-abc',
    attemptsMade: 2,
    retryDelayMs: 2000,
    nextRetryAt: null,
  },
  candidateCount: 5,
  sourceRefreshQueue: { waiting: 2, active: 1, delayed: 3, failed: 4 },
  searchQuota: { host: 'prg.example.edu', dayUTC: '2026-11-11', limit: 0, used: 0, remaining: 0 },
};

describe('admin source dashboard', () => {
  async function setup() {
    const api = {
      list: vi.fn().mockResolvedValue([source]),
      get: vi.fn().mockResolvedValue(detail),
      run: vi.fn().mockResolvedValue({ sourceId, jobId: 'manual-job-1', state: 'queued' }),
    };
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [AdminSourceDashboard],
      providers: [
        { provide: AdminSourceApiService, useValue: api },
        { provide: AdminSessionService, useValue: { signOut: vi.fn() } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminSourceDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    return { fixture, api, router };
  }

  it('shows persisted source failures, candidate count, retry queue, and global queue state', async () => {
    const { fixture } = await setup();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('5');
    expect(page.textContent).toContain('HTTP_5XX');
    expect(page.textContent).toContain('503');
    expect(page.textContent).toContain('Retentativas');
    expect(page.textContent).toContain('Contagens da fila compartilhada');
    expect(page.textContent).toContain('source-refresh-abc');
  });

  it('requires an explicit confirmation reason before requesting a source run', async () => {
    const { fixture, api } = await setup();
    const component = fixture.componentInstance;
    component.openRunConfirmation();
    await component.run();
    expect(api.run).not.toHaveBeenCalled();

    component.runReason.set('Investigar falha HTTP registrada.');
    await component.run();
    expect(api.run).toHaveBeenCalledWith(sourceId, 'Investigar falha HTTP registrada.');
    expect(component.message()).toContain('manual-job-1');
  });

  it('does not expose a run action for blocked or unreviewed sources', async () => {
    const { fixture, api } = await setup();
    const component = fixture.componentInstance;
    const blocked = {
      ...detail,
      health: 'BLOCKED',
    } satisfies AdminSourceDetail;
    expect(component.runEligible(blocked)).toBe(false);
    component.detail.set(blocked);
    component.runReason.set('Attempt');
    await component.run();
    expect(api.run).not.toHaveBeenCalled();
  });
});
