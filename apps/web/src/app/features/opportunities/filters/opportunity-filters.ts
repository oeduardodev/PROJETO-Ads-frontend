import { Component, effect, input, output, signal, type OnDestroy } from '@angular/core';
import type { OpportunityFilterPatch, OpportunityFilterState } from './opportunity-filter.types';

@Component({
  selector: 'app-opportunity-filters',
  templateUrl: './opportunity-filters.html',
  styleUrl: './opportunity-filters.css',
})
export class OpportunityFilters implements OnDestroy {
  readonly filters = input.required<OpportunityFilterState>();
  readonly changed = output<OpportunityFilterPatch>();
  readonly qDraft = signal('');
  private qTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => this.qDraft.set(this.filters().q));
  }

  ngOnDestroy(): void {
    if (this.qTimer) clearTimeout(this.qTimer);
  }

  textChanged(key: 'uf' | 'city' | 'degree' | 'modality' | 'type', event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.changed.emit({ [key]: value });
  }

  queryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.qDraft.set(value);
    if (this.qTimer) clearTimeout(this.qTimer);
    this.qTimer = setTimeout(() => this.changed.emit({ q: value.trim() }), 300);
  }

  selectChanged(key: 'requiresEnem' | 'openOnly' | 'sort', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const patch: OpportunityFilterPatch =
      key === 'openOnly'
        ? { openOnly: value === 'true' }
        : key === 'sort'
          ? { sort: value as OpportunityFilterState['sort'] }
          : { requiresEnem: value as OpportunityFilterState['requiresEnem'] };
    this.changed.emit(patch);
  }

  clear(): void {
    this.qDraft.set('');
    if (this.qTimer) clearTimeout(this.qTimer);
    this.changed.emit({
      q: '',
      uf: '',
      city: '',
      degree: '',
      modality: '',
      requiresEnem: '',
      type: '',
      openOnly: false,
      sort: 'recent',
    });
  }
}
