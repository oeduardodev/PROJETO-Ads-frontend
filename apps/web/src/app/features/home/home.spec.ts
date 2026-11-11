import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { Home } from './home';
import { OpportunitiesPreview } from './opportunities-preview';

describe('public home', () => {
  it('clearly distinguishes catalog preparation from verified opportunities', async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('revisão humana');
    expect(page.textContent).toContain('data da última verificação');
    expect(page.textContent).toContain('Os documentos oficiais prevalecem');
    expect(page.querySelector('a[href="/oportunidades"]')).not.toBeNull();
    expect(page.querySelector('a[href="/oportunidades?type=SEM_ENEM"]')).not.toBeNull();
    expect(page.querySelectorAll('a[href^="http"]').length).toBe(0);
  });

  it('sends quick search text to opportunities without claiming current openings', async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#quick-search-input') as HTMLInputElement;
    input.value = '  Engenharia  ';
    input.dispatchEvent(new Event('input'));
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(navigate).toHaveBeenCalledWith(['/oportunidades'], {
      queryParams: { q: 'Engenharia' },
    });
  });

  it('offers a truthful empty catalog route instead of invented cards', async () => {
    await TestBed.configureTestingModule({
      imports: [OpportunitiesPreview],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(OpportunitiesPreview);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('ainda não tem processos verificados');
    expect(page.textContent).toContain('Isso não indica ausência de oportunidades');
    expect(page.querySelectorAll('a[href^="http"]').length).toBe(0);
  });
});
