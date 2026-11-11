import { Component, input } from '@angular/core';

export type UiBadgeTone =
  'neutral' | 'positive' | 'notice' | 'negative' | 'lime' | 'blue' | 'lilac';

@Component({
  selector: 'ui-badge',
  standalone: true,
  template: `
    <span
      class="ui-badge"
      [class.ui-badge--positive]="tone() === 'positive'"
      [class.ui-badge--notice]="tone() === 'notice'"
      [class.ui-badge--negative]="tone() === 'negative'"
      [class.ui-badge--lime]="tone() === 'lime'"
      [class.ui-badge--blue]="tone() === 'blue'"
      [class.ui-badge--lilac]="tone() === 'lilac'"
    >
      <ng-content />
    </span>
  `,
})
export class UiBadge {
  readonly tone = input<UiBadgeTone>('neutral');
}
