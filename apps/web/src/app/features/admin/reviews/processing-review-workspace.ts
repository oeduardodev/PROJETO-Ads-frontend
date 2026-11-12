import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AdminReviewApiService } from './admin-review-api.service';
import type { ProcessingReviewItem, ProcessingReviewProcessOption } from './review.types';

@Component({
  selector: 'app-processing-review-workspace',
  imports: [DatePipe, JsonPipe],
  templateUrl: './processing-review-workspace.html',
})
export class ProcessingReviewWorkspace {
  readonly items = signal<ProcessingReviewItem[]>([]);
  readonly selected = signal<ProcessingReviewItem | null>(null);
  readonly processes = signal<ProcessingReviewProcessOption[]>([]);
  readonly selectedInstitutionId = signal('');
  readonly selectedProcessId = signal('');
  readonly mode = signal<'draft' | 'associate'>('draft');
  readonly reason = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  private readonly api = inject(AdminReviewApiService);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.api.listProcessingArtifacts();
      this.items.set(response.data);
      if (this.selected() && !response.data.some((item) => item.id === this.selected()?.id)) {
        this.selected.set(null);
      }
    } catch {
      this.error.set(
        'Não foi possível carregar os artefatos pendentes. Confira sua sessão e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async open(item: ProcessingReviewItem): Promise<void> {
    this.selected.set(item);
    this.selectedInstitutionId.set(item.eligibleInstitutions[0]?.id ?? '');
    this.selectedProcessId.set('');
    this.reason.set('');
    this.message.set('');
    this.processes.set([]);
    await this.loadProcesses(item.id);
  }

  async chooseInstitution(id: string): Promise<void> {
    this.selectedInstitutionId.set(id);
    this.selectedProcessId.set('');
    const item = this.selected();
    if (item) await this.loadProcesses(item.id);
  }

  chooseMode(mode: 'draft' | 'associate'): void {
    this.mode.set(mode);
    this.selectedProcessId.set('');
  }

  async resolve(): Promise<void> {
    const item = this.selected();
    const reason = this.reason().trim();
    if (
      !item ||
      !reason ||
      (this.mode() === 'draft' && !this.selectedInstitutionId()) ||
      (this.mode() === 'associate' && !this.selectedProcessId())
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await this.api.resolveProcessingArtifact(item.id, {
        expectedReviewVersion: item.reviewVersion,
        reason,
        ...(this.mode() === 'draft'
          ? { institutionId: this.selectedInstitutionId() }
          : { processId: this.selectedProcessId() }),
      });
      this.message.set(
        this.mode() === 'draft'
          ? 'Rascunho criado e vinculado para revisão humana.'
          : 'Artefato associado ao processo selecionado.',
      );
      this.selected.set(null);
      await this.load();
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? 'Este item mudou durante a revisão. Atualize a fila antes de continuar.'
          : 'Não foi possível concluir a revisão. Confira a proveniência e tente novamente.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  safeUrl(value: string): string | null {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
    } catch {
      return null;
    }
  }

  label(item: ProcessingReviewItem): string {
    return item.discoveredUrl?.canonicalUrl ?? item.document.url;
  }

  private async loadProcesses(id: string): Promise<void> {
    const institutionId = this.selectedInstitutionId();
    if (!institutionId) {
      this.processes.set([]);
      return;
    }
    try {
      this.processes.set(await this.api.processingProcessOptions(id, institutionId));
    } catch {
      this.processes.set([]);
    }
  }
}
