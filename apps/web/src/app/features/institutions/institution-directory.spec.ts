import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PublicCatalogService } from '../../core/api/public-catalog.service';
import type { Institution, InstitutionList } from '../../core/api/generated';
import { InstitutionDirectory } from './institution-directory';

const institution: Institution = {
  id: 'institution-1',
  name: 'Universidade Federal de Exemplo',
  acronym: 'UFE',
  jurisdiction: 'FEDERAL',
  verifiedAt: '2026-10-30T12:00:00.000Z',
  referenceUrl: null,
  campuses: [
    {
      id: 'campus-1',
      name: 'Campus Central',
      city: 'Cidade Exemplo',
      state: 'PB',
      timezone: 'America/Fortaleza',
      verifiedAt: '2026-10-30T12:00:00.000Z',
    },
  ],
  monitoring: {
    activeSourceCount: 2,
    lastCheckedAt: '2026-11-10T12:00:00.000Z',
    lastSuccessAt: '2026-11-09T12:00:00.000Z',
  },
};

function result(data: Institution[] = [institution], total = data.length): InstitutionList {
  return { data, meta: { page: 1, pageSize: 25, total } };
}

describe('public institution directory', () => {
  async function setup(
    institutions = vi.fn().mockResolvedValue(result()),
    initialQuery: Record<string, string> = {},
  ) {
    const queryParams = new BehaviorSubject(convertToParamMap(initialQuery));
    const route = {
      snapshot: { queryParamMap: queryParams.value },
      queryParamMap: queryParams.asObservable(),
    };
    await TestBed.configureTestingModule({
      imports: [InstitutionDirectory],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: PublicCatalogService, useValue: { institutions } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(InstitutionDirectory);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, institutions, queryParams, route };
  }

  it('shows verification and monitoring data received from the public API', async () => {
    const { fixture, institutions } = await setup();
    const page = fixture.nativeElement as HTMLElement;
    expect(institutions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 25 }),
      expect.any(AbortSignal),
    );
    expect(page.textContent).toContain('Universidade Federal de Exemplo');
    expect(page.textContent).toContain('Instituição federal');
    expect(page.textContent).toContain('2 fontes ativas');
    expect(page.textContent).toContain('Campus Central');
    expect(page.textContent).toContain('Cidade Exemplo/PB');
    expect(page.textContent).toContain('não garantem que todos os editais');
    expect(page.querySelectorAll('.institution-card')).toHaveLength(1);
    expect(page.querySelectorAll('a[href^="http"]')).toHaveLength(0);
  });

  it('shows an honest empty state without local seed institutions', async () => {
    const { fixture } = await setup(vi.fn().mockResolvedValue(result([])));
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Nenhuma instituição verificada está disponível');
    expect(page.textContent).toContain('Isso não significa ausência de processos');
    expect(page.querySelectorAll('.institution-card')).toHaveLength(0);
  });

  it('retries after a recoverable API error', async () => {
    const institutions = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(result());
    const { fixture } = await setup(institutions);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Não conseguimos consultar o diretório');
    (page.querySelector('.institutions__state button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(institutions).toHaveBeenCalledTimes(2);
    expect(page.querySelector('.institution-card')).not.toBeNull();
  });

  it('reads and changes the page through the query string', async () => {
    const institutions = vi.fn().mockResolvedValue(result([institution], 60));
    const { fixture, route, queryParams } = await setup(institutions, { page: '2' });
    expect(institutions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, page_size: 25 }),
      expect.any(AbortSignal),
    );
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.componentInstance.goToPage(3);
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { page: 3 },
      queryParamsHandling: 'merge',
    });
    queryParams.next(convertToParamMap({ page: '3' }));
    await fixture.whenStable();
    expect(institutions).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3, page_size: 25 }),
      expect.any(AbortSignal),
    );
  });

  it('passes server-side filters from the URL to the generated API client', async () => {
    const institutions = vi.fn().mockResolvedValue(result());
    await setup(institutions, {
      q: 'universidade',
      uf: 'PB',
      city: 'João Pessoa',
      jurisdiction: 'FEDERAL',
    });
    expect(institutions).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 25,
        q: 'universidade',
        uf: 'PB',
        city: 'João Pessoa',
        jurisdiction: 'FEDERAL',
      },
      expect.any(AbortSignal),
    );
  });

  it('stores filter changes in the URL and resets the page', async () => {
    const { fixture, route } = await setup(vi.fn().mockResolvedValue(result()), { page: '4' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.changeFilters({ q: 'UFPB', uf: 'PB', jurisdiction: 'FEDERAL' });
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: {
        q: 'UFPB',
        uf: 'PB',
        city: null,
        jurisdiction: 'FEDERAL',
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  });
});
