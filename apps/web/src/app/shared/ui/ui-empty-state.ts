import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  template: `
    <section class="ui-empty-state" [attr.aria-labelledby]="titleId()">
      @if (symbol()) {
        <span class="ui-empty-state__symbol" aria-hidden="true">{{ symbol() }}</span>
      }
      <h2 [id]="titleId()">{{ title() }}</h2>
      <p>{{ description() }}</p>
      <div class="ui-empty-state__actions"><ng-content /></div>
    </section>
  `,
})
export class UiEmptyState {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly titleId = input('empty-state-title');
  readonly symbol = input('↗');
}
