import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  template: `
    <article class="ui-card" [class.ui-card--interactive]="interactive()">
      <ng-content />
    </article>
  `,
})
export class UiCard {
  readonly interactive = input(false);
}
