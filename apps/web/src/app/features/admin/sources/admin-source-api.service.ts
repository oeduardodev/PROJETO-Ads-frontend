import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PUBLIC_ENVIRONMENT } from '../../../core/public-environment';
import { AdminAuthenticationRequiredError } from '../reviews/admin-review-api.service';
import { AdminSessionService } from '../admin-session.service';
import type { AdminSource, AdminSourceDetail, ManualSourceRunResult } from './source.types';

@Injectable({ providedIn: 'root' })
export class AdminSourceApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AdminSessionService);
  private readonly environment = inject(PUBLIC_ENVIRONMENT);

  private get baseUrl(): string {
    return `${this.environment.apiBaseUrl.replace(/\/$/u, '')}/api/v1/admin/sources`;
  }

  async list(page = 1): Promise<AdminSource[]> {
    const headers = await this.headers();
    const params = new HttpParams().set('page', page).set('page_size', 100);
    return firstValueFrom(this.http.get<AdminSource[]>(this.baseUrl, { headers, params }));
  }

  async get(id: string): Promise<AdminSourceDetail> {
    const headers = await this.headers();
    return firstValueFrom(
      this.http.get<AdminSourceDetail>(`${this.baseUrl}/${encodeURIComponent(id)}`, { headers }),
    );
  }

  async run(id: string, reason: string): Promise<ManualSourceRunResult> {
    const headers = await this.headers();
    return firstValueFrom(
      this.http.post<ManualSourceRunResult>(
        `${this.baseUrl}/${encodeURIComponent(id)}/run`,
        { reason },
        { headers },
      ),
    );
  }

  private async headers(): Promise<HttpHeaders> {
    const token = await this.session.accessToken();
    if (!token) throw new AdminAuthenticationRequiredError();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
