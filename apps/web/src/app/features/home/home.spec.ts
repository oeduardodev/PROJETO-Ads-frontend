import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Home } from './home';

describe('public home', () => {
  it('keeps the unreviewed catalog clearly unavailable', async () => {
    await TestBed.configureTestingModule({ imports: [Home] }).compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('O catálogo de oportunidades está em preparação');
    expect(page.textContent).toContain('fonte oficial e revisão humana');
    expect(page.querySelectorAll('a[href^="http"]').length).toBe(0);
  });
});
