import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-feedback',
  standalone: true,
  template: `
    <div
      class="ui-feedback"
      [class.ui-feedback--success]="tone() === 'success'"
      [class.ui-feedback--info]="tone() === 'info'"
      [class.ui-feedback--warning]="tone() === 'warning'"
      [class.ui-feedback--error]="tone() === 'error'"
      [attr.role]="tone() === 'error' || tone() === 'warning' ? 'alert' : 'status'"
      [attr.aria-live]="tone() === 'error' || tone() === 'warning' ? 'assertive' : 'polite'"
    >
      <ng-content />
    </div>
  `,
})
export class UiFeedback {
  readonly tone = input<'success' | 'info' | 'warning' | 'error'>('info');
}
