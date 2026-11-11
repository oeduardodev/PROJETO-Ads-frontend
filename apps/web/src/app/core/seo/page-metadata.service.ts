import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PUBLIC_ENVIRONMENT } from '../public-environment';

export interface PageMetadata {
  title: string;
  description: string;
  path: string;
  indexable: boolean;
}

@Injectable({ providedIn: 'root' })
export class PageMetadataService {
  private readonly document = inject(DOCUMENT);
  private readonly environment = inject(PUBLIC_ENVIRONMENT);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.applyCurrentRoute());
  }

  apply(metadata: PageMetadata): void {
    this.title.setTitle(metadata.title);
    this.upsertMeta('name', 'description', metadata.description);
    this.upsertMeta('name', 'robots', metadata.indexable ? 'index, follow' : 'noindex, nofollow');
    this.upsertMeta('property', 'og:title', metadata.title);
    this.upsertMeta('property', 'og:description', metadata.description);
    this.upsertMeta('property', 'og:type', 'website');

    const canonicalUrl = metadata.indexable ? this.canonicalUrl(metadata.path) : null;
    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalUrl) {
      if (!canonical) {
        canonical = this.document.createElement('link');
        canonical.rel = 'canonical';
        this.document.head.append(canonical);
      }
      canonical.href = canonicalUrl;
      this.upsertMeta('property', 'og:url', canonicalUrl);
    } else {
      canonical?.remove();
      this.document.head.querySelector('meta[property="og:url"]')?.remove();
    }
  }

  private applyCurrentRoute(): void {
    let route = this.router.routerState.snapshot.root;
    let title: string | undefined;
    let description: string | undefined;
    let indexable = false;
    while (route) {
      title = route.title ?? title;
      description =
        typeof route.data['description'] === 'string' ? route.data['description'] : description;
      if (route.data['indexable'] === true) indexable = true;
      if (route.data['indexable'] === false) indexable = false;
      if (!route.firstChild) break;
      route = route.firstChild;
    }
    this.apply({
      title: title ?? 'Além do SiSU',
      description: description
        ? description
        : 'Descubra outras formas verificáveis de ingressar em instituições públicas de ensino superior.',
      path: this.router.url.split(/[?#]/, 1)[0] || '/',
      indexable,
    });
  }

  private canonicalUrl(path: string): string | null {
    const base = this.environment.publicSiteUrl.trim();
    if (!base) return null;
    try {
      const parsedBase = new URL(base);
      if (
        parsedBase.protocol !== 'https:' ||
        parsedBase.username ||
        parsedBase.password ||
        parsedBase.search ||
        parsedBase.hash
      )
        return null;
      const pathname = path.split(/[?#]/, 1)[0] || '/';
      return new URL(
        pathname.startsWith('/') ? pathname.slice(1) : pathname,
        `${parsedBase.origin}/`,
      ).href;
    } catch {
      return null;
    }
  }

  private upsertMeta(key: 'name' | 'property', value: string, content: string): void {
    const escaped = value.replaceAll('"', '\\"');
    const selector = `meta[${key}="${escaped}"]`;
    const existing = this.document.head.querySelector(selector);
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      const meta = this.document.createElement('meta');
      meta.setAttribute(key, value);
      meta.content = content;
      this.document.head.append(meta);
    }
  }
}
