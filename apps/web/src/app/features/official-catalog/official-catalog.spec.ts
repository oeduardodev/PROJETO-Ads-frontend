import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { OfficialCatalog } from './official-catalog';
import { PUBLIC_ENVIRONMENT } from '../../core/public-environment';
import { OFFICIAL_INSTITUTIONS, OFFICIAL_LISTINGS } from './official-links';

describe('first-version official catalog', () => {
  it('adds automatically selected official links and rejects external domains', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PUBLIC_ENVIRONMENT,
          useValue: { apiBaseUrl: 'https://api.example.test' },
        },
      ],
    });
    const fixture = TestBed.createComponent(OfficialCatalog);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('https://api.example.test/api/v1/official-feed').flush({
      checkedAt: '2026-11-15T00:00:00.000Z',
      items: [
        {
          institution: 'UFPB',
          title: 'Novo processo de transferência',
          url: 'https://www.prg.ufpb.br/edital/novo-processo/',
          category: 'Transferência',
        },
        {
          institution: 'UFPB',
          title: 'Link externo indevido',
          url: 'https://example.test/edital/',
          category: 'Transferência',
        },
      ],
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.listings()).toHaveLength(7);
    expect(fixture.nativeElement.textContent).toContain('Novo processo de transferência');
    expect(fixture.nativeElement.textContent).not.toContain('Link externo indevido');
    http.verify();
  });
  it('includes every public institution in the national census, without duplicate IDs', () => {
    expect(OFFICIAL_INSTITUTIONS).toHaveLength(317);
    expect(new Set(OFFICIAL_INSTITUTIONS.map((item) => item.id)).size).toBe(317);
    expect(new Set(OFFICIAL_INSTITUTIONS.map((item) => item.state)).size).toBe(27);
    expect(
      ['FEDERAL', 'ESTADUAL', 'MUNICIPAL'].map(
        (jurisdiction) =>
          OFFICIAL_INSTITUTIONS.filter((item) => item.jurisdiction === jurisdiction).length,
      ),
    ).toEqual([122, 139, 56]);
    expect(OFFICIAL_INSTITUTIONS.every((item) => item.censusYear === 2024 && item.city)).toBe(true);
  });

  it('filters the national directory by UF and municipality and paginates all records', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'instituicoes',
            component: OfficialCatalog,
            data: { officialView: 'institutions' },
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    let component = await harness.navigateByUrl('/instituicoes', OfficialCatalog);
    expect(component.portals()).toHaveLength(317);
    expect(component.visiblePortals()).toHaveLength(24);
    expect(harness.routeNativeElement?.textContent).toContain(
      'Portal de seleção ainda não informado',
    );
    component = await harness.navigateByUrl(
      '/instituicoes?uf=SP&jurisdiction=MUNICIPAL',
      OfficialCatalog,
    );
    expect(component.portals().length).toBeGreaterThan(0);
    expect(
      component.portals().every((item) => item.state === 'SP' && item.jurisdiction === 'MUNICIPAL'),
    ).toBe(true);
    component = await harness.navigateByUrl('/instituicoes?q=brasilia', OfficialCatalog);
    expect(component.portals().some((item) => item.acronym === 'UNB')).toBe(true);
    expect(harness.routeNativeElement?.textContent).toContain('Acessar site institucional');
    component = await harness.navigateByUrl('/instituicoes?page=999', OfficialCatalog);
    expect(component.currentPage()).toBe(component.pageCount());
    expect(component.visiblePortals().length).toBeGreaterThan(0);
  });

  it('links only to the exact official domains of the listed institutions', () => {
    const domains: Record<string, string> = {
      UFPB: 'prg.ufpb.br',
      UFCG: 'comprov.ufcg.edu.br',
      UEPB: 'uepb.edu.br',
      IFPB: 'estudante.ifpb.edu.br',
    };
    for (const institution of OFFICIAL_INSTITUTIONS) {
      if (!institution.selectionsUrl) continue;
      const url = new URL(institution.selectionsUrl);
      expect(url.protocol).toBe('https:');
      expect(
        url.hostname === domains[institution.acronym] ||
          url.hostname === `www.${domains[institution.acronym]}`,
      ).toBe(true);
    }
    for (const listing of OFFICIAL_LISTINGS) {
      const url = new URL(listing.url);
      expect(url.protocol).toBe('https:');
      expect(
        url.hostname === domains[listing.institution] ||
          url.hostname === `www.${domains[listing.institution]}`,
      ).toBe(true);
    }
  });

  it('shows process pages and portals with a clear deadline caveat', async () => {
    await TestBed.configureTestingModule({
      imports: [OfficialCatalog],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(OfficialCatalog);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('A presença aqui não confirma inscrições abertas');
    expect(page.querySelectorAll('a[href^="https://"]').length).toBe(10);

    fixture.componentInstance.query.set('transferencia');
    fixture.detectChanges();
    expect(fixture.componentInstance.listings().length).toBe(1);
    expect(fixture.componentInstance.portals().map((item) => item.acronym)).toEqual(['UFPB']);

    fixture.componentInstance.query.set('engenharia');
    fixture.detectChanges();
    expect(fixture.componentInstance.listings().length).toBe(0);
    expect(fixture.componentInstance.portals().length).toBe(4);
    expect(page.textContent).toContain('Ainda não indexamos cursos');
  });
});
