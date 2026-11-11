import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PublicCatalogService } from '../../../core/api/public-catalog.service';
import { PublicApiError } from '../../../core/http/public-api-error';
import { PageMetadataService } from '../../../core/seo/page-metadata.service';
import type { ProcessDetail } from '../../../core/api/generated';
import { OpportunityDetail } from './opportunity-detail';

const processId = '11111111-1111-4111-8111-111111111111';

const detail: ProcessDetail = {
  id: processId,
  noticeCode: 'EDITAL-01/2026',
  noticeYear: 2026,
  selectionType: 'Vagas remanescentes',
  requiresEnem: false,
  tuitionFree: true,
  verifiedAt: '2026-10-30T12:00:00.000Z',
  applicationStatus: 'INDETERMINADA',
  officialNoticeUrl: 'https://prg.ufpb.br/edital-01',
  institution: {
    id: 'ufpb',
    name: 'Universidade Federal da Paraíba',
    acronym: 'UFPB',
    jurisdiction: 'FEDERAL',
  },
  offerings: [
    {
      id: 'offer-1',
      courseName: 'Engenharia',
      degreeType: 'Bacharelado',
      modality: 'Presencial',
      shift: 'Integral',
      seats: 2,
      campus: {
        id: 'campus-1',
        name: 'Campus I',
        city: 'João Pessoa',
        state: 'PB',
        timezone: 'America/Fortaleza',
        verifiedAt: '2026-10-30T12:00:00.000Z',
      },
      reservations: [{ id: 'reservation-1', category: 'Ampla concorrência', seats: 1 }],
    },
  ],
  windows: [
    {
      id: 'window-1',
      offeringId: 'offer-1',
      label: 'Inscrições',
      applicationStatus: 'INDETERMINADA',
      startDate: '2026-11-03',
      startTime: null,
      endDate: '2026-11-12',
      endTime: '18:00',
      timezone: 'America/Fortaleza',
      instructionsUrl: 'https://prg.ufpb.br/inscricoes',
    },
  ],
  requirements: [
    {
      id: 'requirement-1',
      offeringId: 'offer-1',
      reservationId: null,
      criterion: 'Histórico escolar',
      required: true,
      value: null,
    },
  ],
  evidence: [
    {
      fieldPath: 'windows[0].endDate',
      pageOrSection: 'Cronograma, item 2',
      quote: 'As inscrições encerram em 12 de novembro.',
      checkedAt: '2026-10-30T12:00:00.000Z',
      documentUrl: 'https://prg.ufpb.br/edital-01.pdf',
      documentIssuedAt: '2026-10-29',
    },
  ],
};

describe('public opportunity detail', () => {
  async function setup(
    get = vi.fn().mockResolvedValue(detail),
    params = new BehaviorSubject(convertToParamMap({ id: processId })),
  ) {
    const route = { paramMap: params.asObservable(), snapshot: { paramMap: params.value } };
    await TestBed.configureTestingModule({
      imports: [OpportunityDetail],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: PublicCatalogService, useValue: { get } },
        { provide: PageMetadataService, useValue: { apply: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(OpportunityDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, get, params };
  }

  it('renders API detail, verified links, offerings, deadlines, requirements and evidence', async () => {
    const { fixture, get } = await setup();
    const page = fixture.nativeElement as HTMLElement;
    expect(get).toHaveBeenCalledWith(processId, expect.any(AbortSignal));
    expect(page.textContent).toContain('EDITAL-01/2026');
    expect(page.textContent).toContain('30 de outubro de 2026');
    expect(page.textContent).toContain('Campus I');
    expect(page.textContent).toContain('Ampla concorrência: 1');
    expect(page.textContent).toContain('Horário não confirmado');
    expect(page.textContent).toContain('Fuso horário: America/Fortaleza');
    expect(page.textContent).toContain('Histórico escolar');
    expect(page.textContent).toContain('Não confirmado');
    expect(page.textContent).toContain('As inscrições encerram em 12 de novembro.');
    for (const link of page.querySelectorAll('a[target="_blank"]')) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(page.querySelector('a[href="https://prg.ufpb.br/edital-01"]')).not.toBeNull();
    expect(page.querySelector('a[href="https://prg.ufpb.br/inscricoes"]')).not.toBeNull();
  });

  it('states missing information explicitly instead of inferring eligibility', async () => {
    const incomplete: ProcessDetail = {
      ...detail,
      requiresEnem: null,
      offerings: [
        {
          ...detail.offerings[0]!,
          degreeType: null,
          modality: null,
          shift: null,
          seats: null,
          campus: null,
          reservations: [],
        },
      ],
      windows: [],
      requirements: [],
      evidence: [],
    };
    const { fixture } = await setup(vi.fn().mockResolvedValue(incomplete));
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Nota do ENEMNão informado');
    expect(page.textContent).toContain('Campus Não confirmado');
    expect(page.textContent).toContain('Período de inscrição não confirmado');
    expect(page.textContent).toContain('Requisitos não confirmados');
    expect(page.textContent).toContain('Este resumo não determina elegibilidade');
  });

  it('does not reveal whether an unpublished process exists after a 404', async () => {
    const get = vi.fn().mockRejectedValue(new PublicApiError('http', 'not found', 404));
    const { fixture } = await setup(get);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Este processo não está disponível no catálogo público');
    expect(page.textContent).not.toContain('rascunho');
  });

  it('loads the new identifier when the route parameter changes', async () => {
    const get = vi.fn().mockResolvedValue(detail);
    const params = new BehaviorSubject(convertToParamMap({ id: processId }));
    const { fixture } = await setup(get, params);
    params.next(convertToParamMap({ id: '22222222-2222-4222-8222-222222222222' }));
    await fixture.whenStable();
    expect(get).toHaveBeenLastCalledWith(
      '22222222-2222-4222-8222-222222222222',
      expect.any(AbortSignal),
    );
  });
});
