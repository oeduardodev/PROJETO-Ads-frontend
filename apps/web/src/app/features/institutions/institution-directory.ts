import { Component, inject, signal, type OnDestroy, type OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Subscription } from 'rxjs';
import { PublicApiError } from '../../core/http/public-api-error';
import { PublicCatalogService } from '../../core/api/public-catalog.service';
import type { Institution, InstitutionList } from '../../core/api/generated';
import { InstitutionFilters } from './institution-filters';
import type { DirectoryFilterPatch, DirectoryFilters } from './institution-filter.types';

@Component({
  selector: 'app-institution-directory',
  imports: [InstitutionFilters],
  templateUrl: './institution-directory.html',
  styleUrl: './institution-directory.css',
})
export class InstitutionDirectory implements OnInit, OnDestroy {
  readonly result = signal<InstitutionList | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pageCount = signal(0);
  readonly filters = signal<DirectoryFilters>({ q: '', uf: '', city: '', jurisdiction: '' });
  private readonly catalog = inject(PublicCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private request: AbortController | null = null;
  private routeSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      const jurisdiction = params.get('jurisdiction');
      this.filters.set({
        q: params.get('q') ?? '',
        uf: params.get('uf') ?? '',
        city: params.get('city') ?? '',
        jurisdiction: jurisdiction === 'FEDERAL' || jurisdiction === 'ESTADUAL' ? jurisdiction : '',
      });
      const requestedPage = Number(params.get('page'));
      this.page.set(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
      void this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.request?.abort();
  }

  changeFilters(patch: DirectoryFilterPatch): void {
    const next = { ...this.filters(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: next.q || null,
        uf: next.uf || null,
        city: next.city || null,
        jurisdiction: next.jurisdiction || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters(): void {
    this.changeFilters({ q: '', uf: '', city: '', jurisdiction: '' });
  }

  filtersActive(): boolean {
    const filters = this.filters();
    return !!(filters.q || filters.uf || filters.city || filters.jurisdiction);
  }

  async load(): Promise<void> {
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.loading.set(true);
    this.error.set('');
    try {
      const filters = this.filters();
      const result = await this.catalog.institutions(
        {
          page: this.page(),
          page_size: 25,
          q: filters.q || undefined,
          uf: filters.uf || undefined,
          city: filters.city || undefined,
          jurisdiction: filters.jurisdiction || undefined,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      this.result.set(result);
      this.pageCount.set(Math.ceil(result.meta.total / result.meta.pageSize));
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof PublicApiError && error.kind === 'cancelled')
      )
        return;
      this.error.set(
        error instanceof PublicApiError && error.retryable
          ? 'O diretório está temporariamente indisponível. Tente novamente.'
          : 'Não foi possível carregar as instituições verificadas. Tente novamente.',
      );
    } finally {
      if (!controller.signal.aborted) this.loading.set(false);
    }
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.pageCount() || page === this.page()) return;
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  date(value: string | null): string {
    if (!value) return 'Ainda não verificado';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? 'Ainda não verificado'
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
          parsed,
        );
  }

  jurisdiction(value: Institution['jurisdiction']): string {
    return value === 'FEDERAL' ? 'Instituição federal' : 'Instituição estadual';
  }
}
