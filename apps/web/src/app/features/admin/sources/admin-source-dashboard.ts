import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminSessionService } from '../admin-session.service';
import { AdminAuthenticationRequiredError } from '../reviews/admin-review-api.service';
import { AdminSourceApiService } from './admin-source-api.service';
import type { AdminSource, AdminSourceDetail } from './source.types';

@Component({
  selector: 'app-admin-source-dashboard',
  templateUrl: './admin-source-dashboard.html',
})
export class AdminSourceDashboard implements OnInit {
  readonly sources = signal<AdminSource[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly detail = signal<AdminSourceDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly runConfirmation = signal(false);
  readonly runReason = signal('');
  readonly runBusy = signal(false);
  readonly message = signal('');
  readonly runError = signal('');
  readonly activeCount = computed(
    () => this.sources().filter((source) => source.status === 'ACTIVE').length,
  );
  readonly unhealthyCount = computed(
    () => this.sources().filter((source) => ['DEGRADED', 'BLOCKED'].includes(source.health)).length,
  );

  private readonly api = inject(AdminSourceApiService);
  private readonly router = inject(Router);
  private readonly session = inject(AdminSessionService);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const rows = await this.api.list();
      this.sources.set(rows);
      const id = this.selectedId() ?? rows[0]?.id ?? null;
      this.selectedId.set(id);
      if (id) await this.select(id);
      else this.detail.set(null);
    } catch (error) {
      await this.handleError(error, 'Não foi possível carregar as fontes administrativas.');
      this.error.set(this.runError());
    } finally {
      this.loading.set(false);
    }
  }

  async select(id: string): Promise<void> {
    this.selectedId.set(id);
    this.detailLoading.set(true);
    this.detail.set(null);
    this.runConfirmation.set(false);
    this.runReason.set('');
    this.runError.set('');
    try {
      this.detail.set(await this.api.get(id));
    } catch (error) {
      await this.handleError(error, 'Não foi possível consultar o histórico desta fonte.');
    } finally {
      this.detailLoading.set(false);
    }
  }

  openRunConfirmation(): void {
    this.message.set('');
    this.runError.set('');
    this.runReason.set('');
    this.runConfirmation.set(true);
  }

  async run(): Promise<void> {
    const source = this.detail();
    const reason = this.runReason().trim();
    if (!source || !reason || !this.runEligible(source)) return;
    this.runBusy.set(true);
    this.runError.set('');
    try {
      const result = await this.api.run(source.id, reason);
      this.message.set(`Execução solicitada. Identificador da fila: ${result.jobId}.`);
      this.runConfirmation.set(false);
      await this.select(source.id);
    } catch (error) {
      await this.handleError(error, 'Não foi possível solicitar a execução.');
    } finally {
      this.runBusy.set(false);
    }
  }

  runEligible(source: AdminSourceDetail): boolean {
    return (
      source.status === 'ACTIVE' &&
      source.health !== 'BLOCKED' &&
      source.allowedDomain.collectionAllowed &&
      !!source.allowedDomain.reviewedAt
    );
  }

  safeHttpsUrl(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
    } catch {
      return null;
    }
  }

  date(value: string | null | undefined): string {
    return value
      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        )
      : 'Nunca';
  }

  private async handleError(error: unknown, fallback: string): Promise<void> {
    if (
      error instanceof AdminAuthenticationRequiredError ||
      (error instanceof HttpErrorResponse && error.status === 401)
    ) {
      await this.session.signOut();
      await this.router.navigate(['/admin/login'], {
        queryParams: { returnUrl: '/admin/sources' },
      });
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.runError.set('Sua conta não tem permissão para consultar ou executar esta fonte.');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 429) {
      const retryAfter = error.headers.get('Retry-After');
      this.runError.set(
        retryAfter
          ? `Limite de solicitações ativo. Tente novamente em ${retryAfter} s.`
          : 'Limite de solicitações ativo. Aguarde antes de tentar novamente.',
      );
      return;
    }
    this.runError.set(fallback);
  }
}
