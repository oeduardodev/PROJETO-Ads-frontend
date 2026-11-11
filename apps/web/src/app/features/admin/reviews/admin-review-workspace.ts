import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminSessionService } from '../admin-session.service';
import {
  AdminAuthenticationRequiredError,
  AdminReviewApiService,
} from './admin-review-api.service';
import type {
  AdminProcessDetail,
  AdminReviewQueueItem,
  ReviewCorrectionPatch,
} from './review.types';

type CorrectionTarget = ReviewCorrectionPatch['target'];
type CorrectionInput = 'text' | 'number' | 'date' | 'time' | 'boolean' | 'json';
interface CorrectionField {
  value: string;
  label: string;
  input: CorrectionInput;
  nullable: boolean;
}

const CORRECTION_FIELDS: Record<CorrectionTarget, CorrectionField[]> = {
  process: [
    { value: 'noticeCode', label: 'Código do edital', input: 'text', nullable: true },
    { value: 'noticeYear', label: 'Ano do edital', input: 'number', nullable: true },
    { value: 'selectionType', label: 'Tipo de seleção', input: 'text', nullable: false },
    { value: 'regularSisuFlow', label: 'Fluxo regular do SiSU', input: 'boolean', nullable: true },
    { value: 'requiresEnem', label: 'Exige ENEM', input: 'boolean', nullable: true },
    { value: 'tuitionFree', label: 'Gratuidade', input: 'boolean', nullable: true },
    { value: 'referenceUrl', label: 'URL de referência', input: 'text', nullable: true },
  ],
  offering: [
    { value: 'courseName', label: 'Curso', input: 'text', nullable: false },
    { value: 'degreeType', label: 'Grau', input: 'text', nullable: true },
    { value: 'modality', label: 'Modalidade', input: 'text', nullable: true },
    { value: 'shift', label: 'Turno', input: 'text', nullable: true },
    { value: 'seats', label: 'Vagas', input: 'number', nullable: true },
    { value: 'campusId', label: 'ID do campus', input: 'text', nullable: true },
  ],
  window: [
    { value: 'label', label: 'Identificação do prazo', input: 'text', nullable: true },
    { value: 'startDate', label: 'Data inicial', input: 'date', nullable: true },
    { value: 'startTime', label: 'Hora inicial', input: 'time', nullable: true },
    { value: 'endDate', label: 'Data final', input: 'date', nullable: true },
    { value: 'endTime', label: 'Hora final', input: 'time', nullable: true },
    { value: 'timezone', label: 'Fuso horário', input: 'text', nullable: true },
    { value: 'instructionsUrl', label: 'URL de instruções', input: 'text', nullable: true },
  ],
  requirement: [
    { value: 'criterion', label: 'Critério', input: 'text', nullable: false },
    { value: 'required', label: 'Obrigatório', input: 'boolean', nullable: true },
    { value: 'valueJson', label: 'Valor estruturado (JSON)', input: 'json', nullable: true },
  ],
  reservation: [
    { value: 'category', label: 'Categoria de reserva', input: 'text', nullable: false },
    { value: 'seats', label: 'Vagas reservadas', input: 'number', nullable: true },
  ],
};

@Component({
  selector: 'app-admin-review-workspace',
  templateUrl: './admin-review-workspace.html',
})
export class AdminReviewWorkspace implements OnInit {
  readonly queue = signal<AdminReviewQueueItem[]>([]);
  readonly queueLoading = signal(true);
  readonly queueError = signal(false);
  readonly queuePage = signal(1);
  readonly queueTotalPages = signal(1);
  readonly selectedState = signal('NEEDS_REVIEW');
  readonly selectedId = signal<string | null>(null);
  readonly detail = signal<AdminProcessDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal(false);
  readonly selectedEvidenceIds = signal<string[]>([]);
  readonly reason = signal('');
  readonly scopeEligible = signal(false);
  readonly criticalFactsClear = signal(false);
  readonly busy = signal(false);
  readonly stale = signal(false);
  readonly actionMessage = signal('');
  readonly actionError = signal('');
  readonly correctionPatches = signal<ReviewCorrectionPatch[]>([]);
  readonly correctionTarget = signal<CorrectionTarget>('process');
  readonly correctionTargetId = signal('');
  readonly correctionField = signal('noticeCode');
  readonly correctionValue = signal('');
  readonly correctionEvidenceId = signal('');
  readonly correctionError = signal('');
  readonly correctionFields = computed(() => CORRECTION_FIELDS[this.correctionTarget()]);
  readonly correctionTargets = computed(() => this.targetRows(this.correctionTarget()));
  readonly canApprove = computed(
    () =>
      !this.busy() &&
      this.detail()?.ingestionState === 'NEEDS_REVIEW' &&
      this.detail()?.publicationStatus === 'EM_REVISAO' &&
      !this.detail()?.demoHistorical &&
      !!this.reason().trim() &&
      this.selectedEvidenceIds().length > 0 &&
      this.scopeEligible() &&
      this.criticalFactsClear(),
  );
  readonly canReject = computed(
    () =>
      !this.busy() && this.detail()?.ingestionState === 'NEEDS_REVIEW' && !!this.reason().trim(),
  );
  readonly canCorrect = computed(
    () =>
      !this.busy() &&
      ['NEEDS_REVIEW', 'VERIFIED'].includes(this.detail()?.ingestionState ?? '') &&
      !!this.reason().trim() &&
      this.correctionPatches().length > 0,
  );

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AdminReviewApiService);
  private readonly session = inject(AdminSessionService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.selectedId.set(id);
      if (id) void this.loadDetail(id);
      else this.resetDetail();
    });
    void this.loadQueue();
  }

  async loadQueue(): Promise<void> {
    this.queueLoading.set(true);
    this.queueError.set(false);
    try {
      const result = await this.api.list(this.queuePage(), this.selectedState());
      this.queue.set(result.data);
      this.queueTotalPages.set(Math.max(1, result.meta.totalPages));
    } catch (error) {
      await this.handleError(error, 'Não foi possível carregar a fila de revisão.');
      this.queueError.set(true);
    } finally {
      this.queueLoading.set(false);
    }
  }

  async loadDetail(id = this.selectedId()): Promise<void> {
    if (!id) return;
    this.detailLoading.set(true);
    this.detailError.set(false);
    this.stale.set(false);
    this.actionError.set('');
    try {
      this.detail.set(await this.api.get(id));
      this.selectedEvidenceIds.set([]);
      this.correctionEvidenceId.set('');
      this.correctionTargetId.set('');
      this.correctionValue.set('');
      this.scopeEligible.set(false);
      this.criticalFactsClear.set(false);
      this.correctionPatches.set([]);
    } catch (error) {
      await this.handleError(error, 'Não foi possível abrir este edital para revisão.');
      this.detailError.set(true);
    } finally {
      this.detailLoading.set(false);
    }
  }

  async open(item: AdminReviewQueueItem): Promise<void> {
    this.actionMessage.set('');
    this.actionError.set('');
    await this.router.navigate(['/admin/reviews', item.id]);
  }

  async setState(state: string): Promise<void> {
    this.selectedState.set(state);
    this.queuePage.set(1);
    await this.loadQueue();
  }

  async changePage(delta: number): Promise<void> {
    const page = this.queuePage() + delta;
    if (page < 1 || page > this.queueTotalPages()) return;
    this.queuePage.set(page);
    await this.loadQueue();
  }

  toggleEvidence(id: string, checked: boolean): void {
    const current = new Set(this.selectedEvidenceIds());
    if (checked) current.add(id);
    else current.delete(id);
    this.selectedEvidenceIds.set([...current]);
  }

  async approve(): Promise<void> {
    const detail = this.detail();
    if (!detail || !this.canApprove()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      await this.api.approve(detail.id, {
        expectedReviewVersion: detail.reviewVersion,
        reason: this.reason().trim(),
        evidenceIds: this.selectedEvidenceIds(),
        scopeEligible: true,
        unresolvedCriticalFacts: false,
      });
      await this.finishDecision('Edital aprovado e publicado após revisão.');
    } catch (error) {
      await this.handleError(error, 'Não foi possível aprovar este edital.');
    } finally {
      this.busy.set(false);
    }
  }

  async reject(): Promise<void> {
    const detail = this.detail();
    if (!detail || !this.canReject()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      await this.api.reject(detail.id, {
        expectedReviewVersion: detail.reviewVersion,
        reason: this.reason().trim(),
      });
      await this.finishDecision('Edital rejeitado com justificativa registrada.');
    } catch (error) {
      await this.handleError(error, 'Não foi possível rejeitar este edital.');
    } finally {
      this.busy.set(false);
    }
  }

  changeCorrectionTarget(target: CorrectionTarget): void {
    this.correctionTarget.set(target);
    this.correctionField.set(CORRECTION_FIELDS[target][0].value);
    this.correctionTargetId.set('');
  }

  addCorrection(): void {
    const detail = this.detail();
    const field = this.correctionFields().find((item) => item.value === this.correctionField());
    if (!detail || !field) return;
    this.correctionError.set('');
    const evidenceId = this.correctionEvidenceId();
    if (!evidenceId) {
      this.correctionError.set('Escolha a evidência que sustenta esta correção.');
      return;
    }
    const target = this.correctionTarget();
    const targetId = target === 'process' ? undefined : this.correctionTargetId();
    if (target !== 'process' && !targetId) {
      this.correctionError.set('Escolha o item que será corrigido.');
      return;
    }
    const key = `${target}:${targetId ?? detail.id}:${field.value}`;
    if (
      this.correctionPatches().some(
        (patch) => `${patch.target}:${patch.targetId ?? detail.id}:${patch.field}` === key,
      )
    ) {
      this.correctionError.set('Esse campo já está na lista de correções.');
      return;
    }
    try {
      const value = this.parseCorrectionValue(field);
      this.correctionPatches.update((patches) => [
        ...patches,
        {
          target,
          ...(targetId ? { targetId } : {}),
          field: field.value,
          value,
          evidenceId,
        },
      ]);
      this.correctionValue.set('');
    } catch {
      this.correctionError.set(
        field.input === 'json' ? 'Informe um JSON válido.' : 'Confira o valor informado.',
      );
    }
  }

  removeCorrection(index: number): void {
    this.correctionPatches.update((patches) =>
      patches.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async correct(): Promise<void> {
    const detail = this.detail();
    if (!detail || !this.canCorrect()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      const result = await this.api.correct(detail.id, {
        expectedReviewVersion: detail.reviewVersion,
        reason: this.reason().trim(),
        patches: this.correctionPatches(),
      });
      this.actionMessage.set('Correção registrada. O edital voltou para revisão.');
      this.reason.set('');
      await this.loadQueue();
      await this.loadDetail(result.processId);
    } catch (error) {
      await this.handleError(error, 'Não foi possível corrigir este edital.');
    } finally {
      this.busy.set(false);
    }
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

  fact(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'Não informado';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  date(value: string | null): string {
    return value ? value.slice(0, 10) : 'Não informado';
  }

  evidenceLabel(id: string): string {
    const evidence = this.detail()?.evidence.find((item) => item.id === id);
    return evidence
      ? `${evidence.fieldPath} · ${evidence.pageOrSection ?? 'seção não indicada'}`
      : id;
  }

  queueLabel(item: Pick<AdminReviewQueueItem, 'noticeCode' | 'noticeYear'>): string {
    return (
      [item.noticeCode, item.noticeYear].filter((value) => value !== null).join(' / ') ||
      'Edital sem identificação'
    );
  }

  correctionInput(): CorrectionInput {
    return (
      this.correctionFields().find((field) => field.value === this.correctionField())?.input ??
      'text'
    );
  }

  private targetRows(target: CorrectionTarget): Array<{ id: string; label: string }> {
    const detail = this.detail();
    if (!detail) return [];
    switch (target) {
      case 'process':
        return [
          {
            id: detail.id,
            label: `${detail.institution.acronym} · ${
              [detail.noticeCode, detail.noticeYear]
                .filter((value) => value !== null)
                .join(' / ') || 'Edital sem identificação'
            }`,
          },
        ];
      case 'offering':
        return detail.offerings.map((item) => ({ id: item.id, label: item.courseName }));
      case 'window':
        return detail.windows.map((item) => ({
          id: item.id,
          label: item.label || `${this.date(item.startDate)} – ${this.date(item.endDate)}`,
        }));
      case 'requirement':
        return detail.requirements.map((item) => ({ id: item.id, label: item.criterion }));
      case 'reservation':
        return detail.offerings.flatMap((offering) =>
          offering.reservations.map((item) => ({
            id: item.id,
            label: `${offering.courseName} · ${item.category}`,
          })),
        );
    }
  }

  private parseCorrectionValue(field: CorrectionField): unknown {
    const raw = this.correctionValue();
    if (field.input === 'boolean') {
      if (raw === '') return field.nullable ? null : this.invalidValue();
      return raw === 'true';
    }
    if (field.input === 'number') {
      if (raw === '') return field.nullable ? null : this.invalidValue();
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) return this.invalidValue();
      return value;
    }
    if (field.input === 'json') return JSON.parse(raw);
    if (!raw.trim()) return field.nullable ? null : this.invalidValue();
    return raw.trim();
  }

  private invalidValue(): never {
    throw new Error('Invalid correction value');
  }

  private async finishDecision(message: string): Promise<void> {
    this.actionMessage.set(message);
    this.reason.set('');
    await this.loadQueue();
    await this.router.navigate(['/admin/reviews'], { replaceUrl: true });
  }

  private async handleError(error: unknown, fallback: string): Promise<void> {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.stale.set(true);
      this.actionError.set(
        'Este edital mudou desde que foi aberto. Recarregue a versão atual e confira as evidências antes de decidir.',
      );
      return;
    }
    if (
      error instanceof AdminAuthenticationRequiredError ||
      (error instanceof HttpErrorResponse && error.status === 401)
    ) {
      await this.session.signOut();
      await this.router.navigate(['/admin/login'], {
        queryParams: {
          returnUrl: this.selectedId() ? `/admin/reviews/${this.selectedId()}` : '/admin/reviews',
        },
      });
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.actionError.set('Sua conta não tem permissão para esta ação.');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      this.actionError.set('Este edital não está mais disponível para revisão. Atualize a fila.');
      return;
    }
    this.actionError.set(fallback);
  }

  private resetDetail(): void {
    this.detail.set(null);
    this.detailError.set(false);
    this.detailLoading.set(false);
    this.selectedEvidenceIds.set([]);
    this.correctionEvidenceId.set('');
    this.correctionTargetId.set('');
    this.correctionValue.set('');
    this.reason.set('');
    this.scopeEligible.set(false);
    this.criticalFactsClear.set(false);
    this.correctionPatches.set([]);
    this.stale.set(false);
  }
}
