import { Component, inject, signal, type OnDestroy, type OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { PublicApiError } from '../../../core/http/public-api-error';
import { PublicCatalogService } from '../../../core/api/public-catalog.service';
import type { ProcessCard, ProcessList } from '../../../core/api/generated';
import { OpportunityFilters } from '../filters/opportunity-filters';
import {
  DEFAULT_OPPORTUNITY_FILTERS,
  type OpportunityFilterPatch,
  type OpportunityFilterState,
} from '../filters/opportunity-filter.types';

@Component({
  selector: 'app-opportunity-list',
  imports: [OpportunityFilters, RouterLink],
  templateUrl: './opportunity-list.html',
  styleUrl: './opportunity-list.css',
})
export class OpportunityList implements OnInit, OnDestroy {
  readonly results = signal<ProcessList | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly filters = signal<OpportunityFilterState>(DEFAULT_OPPORTUNITY_FILTERS);
  readonly pageSize = 25;
  readonly pageCount = signal(0);

  private readonly catalog = inject(PublicCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private request: AbortController | null = null;
  private routeSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      this.filters.set(this.readFilters(params));
      const requestedPage = Number(params.get('page'));
      this.page.set(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
      void this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.request?.abort();
  }

  private readFilters(params: ParamMap): OpportunityFilterState {
    const requestedSort = params.get('sort');
    const requestedEnem = params.get('requires_enem');
    return {
      q: params.get('q') ?? '',
      uf: params.get('uf') ?? '',
      city: params.get('city') ?? '',
      degree: params.get('degree') ?? '',
      modality: params.get('modality') ?? '',
      requiresEnem:
        requestedEnem === 'true' || requestedEnem === 'false' || requestedEnem === 'unknown'
          ? requestedEnem
          : '',
      type: params.get('type') ?? params.get('selection_type') ?? '',
      openOnly: params.get('open_only') === 'true',
      sort: requestedSort === 'deadline' || requestedSort === 'course' ? requestedSort : 'recent',
    };
  }

  changeFilters(patch: OpportunityFilterPatch): void {
    const next = { ...this.filters(), ...patch };
    const queryParams = {
      q: next.q.trim() || null,
      uf: next.uf.trim() || null,
      city: next.city.trim() || null,
      degree: next.degree.trim() || null,
      modality: next.modality.trim() || null,
      requires_enem: next.requiresEnem || null,
      type: next.type.trim() || null,
      selection_type: null,
      open_only: next.openOnly ? 'true' : null,
      sort: next.sort === 'recent' ? null : next.sort,
      page: null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  async load(): Promise<void> {
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.catalog.search(
        {
          ...this.toApiFilters(),
          page: this.page(),
          page_size: this.pageSize,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      this.results.set(result);
      this.pageCount.set(Math.ceil(result.meta.total / result.meta.pageSize));
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof PublicApiError && error.kind === 'cancelled')
      )
        return;
      this.error.set(
        error instanceof PublicApiError && error.retryable
          ? 'O catálogo está temporariamente indisponível. Tente carregar novamente.'
          : 'Não foi possível carregar as oportunidades verificadas. Tente novamente.',
      );
    } finally {
      if (!controller.signal.aborted) this.loading.set(false);
    }
  }

  private toApiFilters() {
    const filters = this.filters();
    return {
      q: filters.q.trim() || undefined,
      uf: filters.uf.trim() || undefined,
      city: filters.city.trim() || undefined,
      degree: filters.degree.trim() || undefined,
      modality: filters.modality.trim() || undefined,
      requires_enem: filters.requiresEnem || undefined,
      selection_type: filters.type.trim() || undefined,
      open_only: filters.openOnly ? ('true' as const) : undefined,
      sort: filters.sort,
    };
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.pageCount() || page === this.page()) return;
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
    await this.load();
  }

  statusLabel(status: ProcessCard['applicationStatus']): string {
    return {
      ABERTA: 'Inscrições abertas',
      PREVISTA: 'Inscrições previstas',
      ENCERRADA: 'Inscrições encerradas',
      INDETERMINADA: 'Prazo a confirmar',
    }[status];
  }

  deadline(value: string | null): string {
    if (!value) return 'Prazo não confirmado';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
  }
}
