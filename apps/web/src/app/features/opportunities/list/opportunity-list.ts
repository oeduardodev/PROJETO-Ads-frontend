import { Component, inject, signal, type OnDestroy, type OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicApiError } from '../../../core/http/public-api-error';
import { PublicCatalogService } from '../../../core/api/public-catalog.service';
import type { ProcessCard, ProcessList } from '../../../core/api/generated';

@Component({
  selector: 'app-opportunity-list',
  imports: [RouterLink],
  templateUrl: './opportunity-list.html',
  styleUrl: './opportunity-list.css',
})
export class OpportunityList implements OnInit, OnDestroy {
  readonly results = signal<ProcessList | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pageSize = 25;
  readonly pageCount = signal(0);

  private readonly catalog = inject(PublicCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private request: AbortController | null = null;

  ngOnInit(): void {
    const requestedPage = Number(this.route.snapshot.queryParamMap.get('page'));
    this.page.set(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
    void this.load();
  }

  ngOnDestroy(): void {
    this.request?.abort();
  }

  async load(): Promise<void> {
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.catalog.search(
        { page: this.page(), page_size: this.pageSize, sort: 'recent' },
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

  async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.pageCount() || page === this.page()) return;
    this.page.set(page);
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
