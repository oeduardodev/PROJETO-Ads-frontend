import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PUBLIC_ENVIRONMENT } from '../public-environment';
import { PageMetadataService } from './page-metadata.service';

describe('page metadata', () => {
  async function setup(publicSiteUrl: string) {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: PUBLIC_ENVIRONMENT,
          useValue: { publicSiteUrl },
        },
      ],
    }).compileComponents();
    return {
      service: TestBed.inject(PageMetadataService),
      document: TestBed.inject(DOCUMENT),
    };
  }

  it('adds route title and description but omits canonical when the official domain is unset', async () => {
    const { service, document } = await setup('');
    service.apply({
      title: 'Instituições verificadas — Além do SiSU',
      description: 'Consulte instituições públicas verificadas.',
      path: '/instituicoes',
      indexable: true,
    });

    expect(document.title).toBe('Instituições verificadas — Além do SiSU');
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(
      'Consulte instituições públicas verificadas.',
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it('uses the configured HTTPS origin, excludes query filters and marks only public routes indexable', async () => {
    const { service, document } = await setup('https://www.alemdosisu.example/');
    service.apply({
      title: 'Oportunidades — Além do SiSU',
      description: 'Consulte processos verificados.',
      path: '/oportunidades?q=histórico',
      indexable: true,
    });
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://www.alemdosisu.example/oportunidades',
    );
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe(
      'index, follow',
    );

    service.apply({
      title: 'Acesso à curadoria — Além do SiSU',
      description: 'Acesso restrito.',
      path: '/admin/login',
      indexable: false,
    });
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe(
      'noindex, nofollow',
    );
  });

  it('rejects non-HTTPS and malformed public origins', async () => {
    const { service, document } = await setup('http://localhost:4200');
    service.apply({
      title: 'Página pública',
      description: 'Descrição pública.',
      path: '/',
      indexable: true,
    });
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
