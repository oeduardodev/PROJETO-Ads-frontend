import { Component, input } from '@angular/core';

export type UiButtonTone = 'primary' | 'secondary' | 'quiet' | 'danger';
export type UiButtonSize = 'small' | 'medium' | 'large';

@Component({
  selector: 'ui-button',
  standalone: true,
  template: `
    <button
      class="ui-button"
      [class.ui-button--primary]="tone() === 'primary'"
      [class.ui-button--secondary]="tone() === 'secondary'"
      [class.ui-button--quiet]="tone() === 'quiet'"
      [class.ui-button--danger]="tone() === 'danger'"
      [class.ui-button--small]="size() === 'small'"
      [class.ui-button--large]="size() === 'large'"
      [disabled]="disabled()"
      [type]="type()"
    >
      <ng-content />
    </button>
  `,
})
export class UiButton {
  readonly tone = input<UiButtonTone>('primary');
  readonly size = input<UiButtonSize>('medium');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
}
