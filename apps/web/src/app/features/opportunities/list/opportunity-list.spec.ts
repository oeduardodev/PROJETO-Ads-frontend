import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PublicCatalogService } from '../../../core/api/public-catalog.service';
import type { ProcessCard, ProcessList } from '../../../core/api/generated';
import { OpportunityList } from './opportunity-list';

const processId = '11111111-1111-4111-8111-111111111111';
const card: ProcessCard = {
  id: processId,
  noticeCode: 'EDITAL-01/2026',
  selectionType: 'Vagas remanescentes',
  requiresEnem: null,
  verifiedAt: '2026-10-30T12:00:00.000Z',
  officialNoticeUrl: 'https://prg.ufpb.br/edital-01',
  institution: {
    id: 'ufpb',
    name: 'Universidade Federal da Paraíba',
    acronym: 'UFPB',
  },
  offeringCount: 2,
  coursePreview: ['Engenharia', 'Letras'],
  nextDeadlineAt: null,
  applicationStatus: 'INDETERMINADA',
};

function result(data: ProcessCard[] = [card]): ProcessList {
  return { data, meta: { page: 1, pageSize: 25, total: data.length } };
}

describe('public opportunity list', () => {
  async function setup(
    search = vi.fn().mockResolvedValue(result()),
    initialParams: Record<string, string> = {},
  ) {
    const queryParams = new BehaviorSubject(convertToParamMap(initialParams));
    const activatedRoute = {
      snapshot: { queryParamMap: queryParams.value },
      queryParamMap: queryParams.asObservable(),
    };
    await TestBed.configureTestingModule({
      imports: [OpportunityList],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: activatedRoute,
        },
        { provide: PublicCatalogService, useValue: { search } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(OpportunityList);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, search, queryParams, activatedRoute };
  }

  it('renders only API results and links to the verified official notice', async () => {
    const { fixture, search } = await setup();
    const page = fixture.nativeElement as HTMLElement;
    expect(search).toHaveBeenCalledWith(
      { page: 1, page_size: 25, sort: 'recent' },
      expect.any(AbortSignal),
    );
    expect(page.textContent).toContain('EDITAL-01/2026');
    expect(page.textContent).toContain('Universidade Federal da Paraíba');
    expect(page.textContent).toContain('Prazo não confirmado');
    expect(page.querySelector('a[href="https://prg.ufpb.br/edital-01"]')?.getAttribute('rel')).toBe(
      'noopener noreferrer',
    );
    expect(page.querySelector(`a[href="/oportunidades/${processId}"]`)?.textContent).toContain(
      'Ver detalhes e requisitos',
    );
    expect(page.querySelectorAll('.opportunity-card')).toHaveLength(1);
  });

  it('shows an explicit empty state without synthesizing an opportunity', async () => {
    const { fixture } = await setup(vi.fn().mockResolvedValue(result([])));
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Nenhum processo verificado nesta busca');
    expect(page.textContent).toContain('Isso não significa que não existam oportunidades');
    expect(page.querySelectorAll('.opportunity-card')).toHaveLength(0);
  });

  it('shows a recoverable error and retries the API request', async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(result());
    const { fixture } = await setup(search);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Não conseguimos consultar o catálogo');
    const retry = page.querySelector('.opportunities__state button') as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(search).toHaveBeenCalledTimes(2);
    expect(page.querySelector('.opportunity-card')).not.toBeNull();
  });

  it('loads the page requested in the URL', async () => {
    const search = vi
      .fn()
      .mockResolvedValue({ ...result(), meta: { page: 3, pageSize: 25, total: 80 } });
    await setup(search, { page: '3' });
    expect(search).toHaveBeenCalledWith(
      { page: 3, page_size: 25, sort: 'recent' },
      expect.any(AbortSignal),
    );
  });

  it('preserves the URL page when moving through results', async () => {
    const { fixture, activatedRoute } = await setup(
      vi.fn().mockResolvedValue({ ...result(), meta: { page: 1, pageSize: 25, total: 60 } }),
    );
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.componentInstance.goToPage(2);
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: activatedRoute,
      queryParams: { page: 2 },
      queryParamsHandling: 'merge',
    });
  });

  it('maps every supported URL filter to the generated API contract, including unknown ENEM', async () => {
    const search = vi.fn().mockResolvedValue(result());
    await setup(search, {
      q: 'Engenharia',
      uf: 'PB',
      city: 'João Pessoa',
      degree: 'Bacharelado',
      modality: 'Presencial',
      requires_enem: 'unknown',
      type: 'VESTIBULAR_PROPRIO',
      open_only: 'true',
      sort: 'deadline',
      page: '2',
    });
    expect(search).toHaveBeenCalledWith(
      {
        q: 'Engenharia',
        uf: 'PB',
        city: 'João Pessoa',
        degree: 'Bacharelado',
        modality: 'Presencial',
        requires_enem: 'unknown',
        selection_type: 'VESTIBULAR_PROPRIO',
        open_only: 'true',
        sort: 'deadline',
        page: 2,
        page_size: 25,
      },
      expect.any(AbortSignal),
    );
  });

  it('reloads from the query string when browser history changes', async () => {
    const search = vi.fn().mockResolvedValue(result());
    const { fixture, queryParams } = await setup(search);
    queryParams.next(convertToParamMap({ q: 'Letras', type: 'VESTIBULAR_PROPRIO' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'Letras', selection_type: 'VESTIBULAR_PROPRIO', page: 1 }),
      expect.any(AbortSignal),
    );
    expect(fixture.componentInstance.filters().q).toBe('Letras');
  });

  it('updates filter URL keys and resets pagination when a filter changes', async () => {
    const { fixture, activatedRoute } = await setup(vi.fn().mockResolvedValue(result()), {
      q: 'Antigo',
      page: '4',
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.changeFilters({
      q: 'Novo',
      requiresEnem: 'unknown',
      type: 'SEM_ENEM',
    });
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: activatedRoute,
      queryParams: expect.objectContaining({
        q: 'Novo',
        requires_enem: 'unknown',
        type: 'SEM_ENEM',
        selection_type: null,
        page: null,
      }),
      queryParamsHandling: 'merge',
    });
  });
});
