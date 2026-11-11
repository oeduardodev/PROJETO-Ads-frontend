import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiBadge } from './ui-badge';
import { UiButton } from './ui-button';
import { UiEmptyState } from './ui-empty-state';
import { UiFeedback } from './ui-feedback';
import { UiSkeleton } from './ui-skeleton';
import { UiTextField } from './ui-text-field';

describe('shared UI primitives', () => {
  it('keeps buttons native, keyboard focusable, and disabled when requested', async () => {
    await TestBed.configureTestingModule({ imports: [UiButton] }).compileComponents();
    const fixture = TestBed.createComponent(UiButton);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    button.focus();
    expect(document.activeElement).toBe(button);

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
  });

  it('uses a neutral badge by default and exposes the chosen visual tone', async () => {
    await TestBed.configureTestingModule({ imports: [UiBadge] }).compileComponents();
    const fixture = TestBed.createComponent(UiBadge);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.ui-badge') as HTMLElement;
    expect(badge.classList.contains('ui-badge--positive')).toBe(false);
    fixture.componentRef.setInput('tone', 'notice');
    fixture.detectChanges();
    expect(badge.classList.contains('ui-badge--notice')).toBe(true);
  });

  it('associates text fields with labels, hints, errors, and emits entered text', async () => {
    await TestBed.configureTestingModule({ imports: [UiTextField] }).compileComponents();
    const fixture = TestBed.createComponent(UiTextField);
    fixture.componentRef.setInput('id', 'city');
    fixture.componentRef.setInput('label', 'Cidade');
    fixture.componentRef.setInput('hint', 'Digite o nome do município.');
    fixture.componentRef.setInput('error', 'Campo obrigatório.');
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(fixture.nativeElement.querySelector('label')?.htmlFor).toBe('city');
    expect(input.getAttribute('aria-describedby')).toBe('city-hint city-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    let emitted = '';
    fixture.componentInstance.valueChange.subscribe((value) => (emitted = value));
    input.value = 'João Pessoa';
    input.dispatchEvent(new Event('input'));
    expect(emitted).toBe('João Pessoa');
  });

  it('announces error feedback and gives empty and loading states labels', async () => {
    await TestBed.configureTestingModule({
      imports: [UiFeedback, UiEmptyState, UiSkeleton],
    }).compileComponents();
    const feedbackFixture = TestBed.createComponent(UiFeedback);
    feedbackFixture.componentRef.setInput('tone', 'error');
    feedbackFixture.detectChanges();
    expect(feedbackFixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    const emptyFixture = TestBed.createComponent(UiEmptyState);
    emptyFixture.componentRef.setInput('title', 'Nenhum resultado');
    emptyFixture.componentRef.setInput('description', 'Ajuste os filtros para tentar novamente.');
    emptyFixture.detectChanges();
    expect(
      emptyFixture.nativeElement.querySelector('[aria-labelledby="empty-state-title"]'),
    ).not.toBeNull();

    const skeletonFixture = TestBed.createComponent(UiSkeleton);
    skeletonFixture.componentRef.setInput('label', 'Carregando oportunidades');
    skeletonFixture.detectChanges();
    expect(
      skeletonFixture.nativeElement.querySelector('[role="status"]')?.getAttribute('aria-label'),
    ).toBe('Carregando oportunidades');
  });
});
