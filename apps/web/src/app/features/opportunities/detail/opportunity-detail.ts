import { Location } from '@angular/common';
import { Component, inject, signal, type OnDestroy, type OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Subscription } from 'rxjs';
import { PublicApiError } from '../../../core/http/public-api-error';
import { PublicCatalogService } from '../../../core/api/public-catalog.service';
import type { ApplicationWindow, ProcessDetail, Requirement } from '../../../core/api/generated';

@Component({
  selector: 'app-opportunity-detail',
  templateUrl: './opportunity-detail.html',
  styleUrl: './opportunity-detail.css',
})
export class OpportunityDetail implements OnInit, OnDestroy {
  readonly detail = signal<ProcessDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private readonly api = inject(PublicCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private routeSubscription: Subscription | null = null;
  private request: AbortController | null = null;
  private currentId = '';

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      void this.load(params);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.request?.abort();
  }

  async load(params = this.route.snapshot.paramMap): Promise<void> {
    const id = params.get('id');
    if (!id) {
      this.error.set('O endereço deste processo está incompleto.');
      this.loading.set(false);
      return;
    }
    this.currentId = id;
    this.request?.abort();
    const controller = new AbortController();
    this.request = controller;
    this.loading.set(true);
    this.error.set('');
    this.detail.set(null);
    try {
      const process = await this.api.get(id, controller.signal);
      if (controller.signal.aborted || this.currentId !== id) return;
      this.detail.set(process);
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof PublicApiError && error.kind === 'cancelled')
      )
        return;
      this.error.set(
        error instanceof PublicApiError && error.status === 404
          ? 'Este processo não está disponível no catálogo público.'
          : error instanceof PublicApiError && error.retryable
            ? 'O detalhe está temporariamente indisponível. Tente novamente.'
            : 'Não foi possível carregar os dados verificados deste processo. Tente novamente.',
      );
    } finally {
      if (!controller.signal.aborted && this.currentId === id) this.loading.set(false);
    }
  }

  back(): void {
    this.location.back();
  }

  statusLabel(status: ProcessDetail['applicationStatus']): string {
    return {
      ABERTA: 'Inscrições abertas',
      PREVISTA: 'Inscrições previstas',
      ENCERRADA: 'Inscrições encerradas',
      INDETERMINADA: 'Prazo a confirmar',
    }[status];
  }

  enem(value: boolean | null): string {
    return value === null ? 'Não informado' : value ? 'Sim' : 'Não';
  }

  date(value: string | null): string {
    if (!value) return 'Data não confirmada';
    const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(parsed.getTime())
      ? 'Data não confirmada'
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
  }

  timestamp(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? 'Data não confirmada'
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(parsed);
  }

  windowRange(window: ApplicationWindow): string {
    return `${this.date(window.startDate)} — ${this.date(window.endDate)}`;
  }

  requirementValue(requirement: Requirement): string {
    if (requirement.value === null || requirement.value === undefined) return 'Não confirmado';
    if (typeof requirement.value === 'string') return requirement.value;
    if (typeof requirement.value === 'number' || typeof requirement.value === 'boolean') {
      return String(requirement.value);
    }
    return JSON.stringify(requirement.value) ?? 'Não confirmado';
  }

  uniqueCampuses(process: ProcessDetail) {
    const campuses = new Map(
      process.offerings
        .map((offering) => offering.campus)
        .filter((campus) => campus !== null)
        .map((campus) => [campus.id, campus]),
    );
    return [...campuses.values()];
  }

  windowLabel(window: ApplicationWindow): string {
    return window.label || 'Período de inscrição';
  }
}
