import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-skeleton',
  standalone: true,
  template: `
    <span
      class="ui-skeleton"
      [class.ui-skeleton--title]="variant() === 'title'"
      [class.ui-skeleton--text]="variant() === 'text'"
      [class.ui-skeleton--block]="variant() === 'block'"
      role="status"
      [attr.aria-label]="label()"
    ></span>
  `,
})
export class UiSkeleton {
  readonly variant = input<'title' | 'text' | 'block'>('text');
  readonly label = input('Carregando conteúdo');
}
