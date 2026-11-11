import { Component, computed, input as inputSignal, output } from '@angular/core';

export type UiTextFieldType = 'text' | 'search' | 'email' | 'password' | 'number' | 'date' | 'time';

@Component({
  selector: 'ui-text-field',
  standalone: true,
  template: `
    <div class="ui-field">
      <label class="ui-field__label" [for]="id()">
        {{ label() }}
        @if (required()) {
          <span aria-hidden="true">*</span>
        }
      </label>
      <input
        class="ui-input"
        [id]="id()"
        [type]="type()"
        [value]="value()"
        [placeholder]="placeholder()"
        [required]="required()"
        [disabled]="disabled()"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="error() ? 'true' : null"
        (input)="onInput($event)"
      />
      @if (hint()) {
        <small class="ui-field__hint" [id]="id() + '-hint'">{{ hint() }}</small>
      }
      @if (error()) {
        <small class="ui-field__error" [id]="id() + '-error'">{{ error() }}</small>
      }
    </div>
  `,
})
export class UiTextField {
  readonly id = inputSignal.required<string>();
  readonly label = inputSignal.required<string>();
  readonly value = inputSignal('');
  readonly type = inputSignal<UiTextFieldType>('text');
  readonly placeholder = inputSignal('');
  readonly hint = inputSignal('');
  readonly error = inputSignal('');
  readonly required = inputSignal(false);
  readonly disabled = inputSignal(false);
  readonly valueChange = output<string>();
  readonly describedBy = computed(() => {
    const ids = [];
    if (this.hint()) ids.push(`${this.id()}-hint`);
    if (this.error()) ids.push(`${this.id()}-error`);
    return ids.length ? ids.join(' ') : null;
  });

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
