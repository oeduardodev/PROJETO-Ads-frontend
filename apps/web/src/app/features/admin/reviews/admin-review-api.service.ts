import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PUBLIC_ENVIRONMENT } from '../../../core/public-environment';
import { AdminSessionService } from '../admin-session.service';
import type {
  AdminProcessDetail,
  AdminReviewQueueResponse,
  ReviewCommandResult,
  ReviewCorrectionPatch,
  ProcessingReviewQueueResponse,
  ProcessingReviewProcessOption,
} from './review.types';

export class AdminAuthenticationRequiredError extends Error {
  constructor() {
    super('Administrative session required');
  }
}

@Injectable({ providedIn: 'root' })
export class AdminReviewApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AdminSessionService);
  private readonly environment = inject(PUBLIC_ENVIRONMENT);

  private get baseUrl(): string {
    return `${this.environment.apiBaseUrl.replace(/\/$/u, '')}/api/v1/admin`;
  }

  private async headers(): Promise<HttpHeaders> {
    const token = await this.session.accessToken();
    if (!token) throw new AdminAuthenticationRequiredError();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  async list(page = 1, state = 'NEEDS_REVIEW'): Promise<AdminReviewQueueResponse> {
    const headers = await this.headers();
    const params = new HttpParams().set('page', page).set('state', state);
    return firstValueFrom(
      this.http.get<AdminReviewQueueResponse>(`${this.baseUrl}/review-queue`, { headers, params }),
    );
  }

  async listProcessingArtifacts(page = 1): Promise<ProcessingReviewQueueResponse> {
    const headers = await this.headers();
    const params = new HttpParams().set('page', page);
    return firstValueFrom(
      this.http.get<ProcessingReviewQueueResponse>(`${this.baseUrl}/processing-review-queue`, {
        headers,
        params,
      }),
    );
  }

  async processingProcessOptions(
    id: string,
    institutionId: string,
  ): Promise<ProcessingReviewProcessOption[]> {
    const headers = await this.headers();
    const params = new HttpParams().set('institution_id', institutionId);
    return firstValueFrom(
      this.http.get<ProcessingReviewProcessOption[]>(
        `${this.baseUrl}/processing-review-queue/${encodeURIComponent(id)}/process-options`,
        { headers, params },
      ),
    );
  }

  async resolveProcessingArtifact(
    id: string,
    body: {
      expectedReviewVersion: number;
      reason: string;
      processId?: string;
      institutionId?: string;
    },
  ): Promise<{ id: string; status: string; processId: string; reviewVersion: number }> {
    const headers = await this.headers();
    return firstValueFrom(
      this.http.post<{ id: string; status: string; processId: string; reviewVersion: number }>(
        `${this.baseUrl}/processing-review-queue/${encodeURIComponent(id)}/resolve`,
        body,
        { headers },
      ),
    );
  }

  async get(id: string): Promise<AdminProcessDetail> {
    const headers = await this.headers();
    return firstValueFrom(
      this.http.get<AdminProcessDetail>(`${this.baseUrl}/processes/${encodeURIComponent(id)}`, {
        headers,
      }),
    );
  }

  async approve(
    id: string,
    body: {
      expectedReviewVersion: number;
      reason: string;
      evidenceIds: string[];
      scopeEligible: true;
      unresolvedCriticalFacts: false;
    },
  ): Promise<ReviewCommandResult> {
    return this.command('POST', id, 'approve', body);
  }

  async reject(
    id: string,
    body: { expectedReviewVersion: number; reason: string },
  ): Promise<ReviewCommandResult> {
    return this.command('POST', id, 'reject', body);
  }

  async correct(
    id: string,
    body: { expectedReviewVersion: number; reason: string; patches: ReviewCorrectionPatch[] },
  ): Promise<ReviewCommandResult> {
    return this.command('PATCH', id, 'correct', body);
  }

  private async command(
    method: 'POST' | 'PATCH',
    id: string,
    action: string,
    body: object,
  ): Promise<ReviewCommandResult> {
    const headers = await this.headers();
    return firstValueFrom(
      this.http.request<ReviewCommandResult>(
        method,
        `${this.baseUrl}/processes/${encodeURIComponent(id)}/${action}`,
        { headers, body },
      ),
    );
  }
}
