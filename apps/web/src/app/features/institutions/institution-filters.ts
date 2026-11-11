import { Component, effect, input, output, signal, type OnDestroy } from '@angular/core';
import type { DirectoryFilterPatch, DirectoryFilters } from './institution-filter.types';

@Component({
  selector: 'app-institution-filters',
  templateUrl: './institution-filters.html',
  styleUrl: './institution-filters.css',
})
export class InstitutionFilters implements OnDestroy {
  readonly filters = input.required<DirectoryFilters>();
  readonly changed = output<DirectoryFilterPatch>();
  readonly clear = output<void>();
  readonly qDraft = signal('');
  private qTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => this.qDraft.set(this.filters().q));
  }

  ngOnDestroy(): void {
    if (this.qTimer) clearTimeout(this.qTimer);
  }

  queryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.qDraft.set(value);
    if (this.qTimer) clearTimeout(this.qTimer);
    this.qTimer = setTimeout(() => this.changed.emit({ q: value.trim() }), 300);
  }

  textChanged(key: 'uf' | 'city', event: Event): void {
    this.changed.emit({ [key]: (event.target as HTMLInputElement).value.trim() });
  }

  jurisdictionChanged(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DirectoryFilters['jurisdiction'];
    this.changed.emit({ jurisdiction: value });
  }

  clearFilters(): void {
    this.qDraft.set('');
    if (this.qTimer) clearTimeout(this.qTimer);
    this.clear.emit();
  }
}
