import { Component, computed, inject, signal, type OnDestroy, type OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import type { Subscription } from 'rxjs';
import { PUBLIC_ENVIRONMENT } from '../../core/public-environment';
import {
  OFFICIAL_INSTITUTIONS,
  OFFICIAL_LISTINGS,
  normalizeOfficialSearch,
  type OfficialInstitution,
  type OfficialListing,
} from './official-links';

const OFFICIAL_HOSTS: Record<string, string> = {
  UFPB: 'www.prg.ufpb.br',
  UFCG: 'comprov.ufcg.edu.br',
  UEPB: 'uepb.edu.br',
  IFPB: 'estudante.ifpb.edu.br',
};

function isOfficialListing(value: unknown): value is OfficialListing {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OfficialListing>;
  if (!item.institution || typeof item.title !== 'string' || typeof item.url !== 'string') {
    return false;
  }
  try {
    const url = new URL(item.url);
    return (
      url.protocol === 'https:' &&
      url.hostname === OFFICIAL_HOSTS[item.institution] &&
      !url.username &&
      !url.password &&
      typeof item.category === 'string' &&
      item.title.length >= 8
    );
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-official-catalog',
  imports: [DatePipe],
  templateUrl: './official-catalog.html',
  styleUrl: './official-catalog.css',
})
export class OfficialCatalog implements OnInit, OnDestroy {
  readonly institutionsView: boolean;
  readonly query = signal('');
  readonly typedQuery = signal('');
  readonly jurisdiction = signal('');
  readonly state = signal('');
  readonly page = signal(1);
  readonly pageSize = 24;
  readonly states = [...new Set(OFFICIAL_INSTITUTIONS.map((item) => item.state))].sort();
  readonly totalInstitutions = OFFICIAL_INSTITUTIONS.length;
  readonly auditedWebsiteCount = OFFICIAL_INSTITUTIONS.filter((item) => item.websiteUrl).length;
  readonly refreshedAt = signal<string | null>(null);
  readonly refreshedListings = signal<OfficialListing[]>([]);
  readonly allListings = computed(() => {
    const merged = new Map<string, OfficialListing>();
    for (const listing of [...this.refreshedListings(), ...OFFICIAL_LISTINGS]) {
      if (!merged.has(listing.url)) merged.set(listing.url, listing);
    }
    return [...merged.values()];
  });
  readonly institutions = computed(() =>
    OFFICIAL_INSTITUTIONS.filter((institution) => {
      if (!this.matchesLocation(institution)) return false;
      const text = `${institution.id} ${institution.acronym} ${institution.name} ${institution.state} ${institution.stateName} ${institution.city}`;
      return (
        this.matchesText(text) ||
        (!this.institutionsView &&
          this.allListings().some(
            (listing) =>
              listing.institution === institution.acronym &&
              this.matchesText(`${listing.title} ${listing.category}`),
          ))
      );
    }),
  );
  readonly portals = computed(() => {
    if (this.institutionsView) return this.institutions();
    const matches = this.institutions().filter((item) => item.selectionsUrl);
    if (matches.length || !this.query().trim()) return matches;
    return OFFICIAL_INSTITUTIONS.filter((item) => item.selectionsUrl && this.matchesLocation(item));
  });
  readonly pageCount = computed(() => Math.ceil(this.portals().length / this.pageSize));
  readonly currentPage = computed(() => Math.max(1, Math.min(this.page(), this.pageCount() || 1)));
  readonly visiblePortals = computed(() =>
    this.portals().slice(
      (this.currentPage() - 1) * this.pageSize,
      this.currentPage() * this.pageSize,
    ),
  );
  readonly listings = computed(() =>
    this.allListings().filter((listing) => {
      const institution = OFFICIAL_INSTITUTIONS.find(
        (item) => item.acronym === listing.institution,
      );
      return (
        institution &&
        this.matchesLocation(institution) &&
        this.matchesText(
          `${listing.title} ${listing.category} ${institution.name} ${institution.acronym} ${institution.city}`,
        )
      );
    }),
  );

  private matchesLocation(institution: OfficialInstitution): boolean {
    return (
      (!this.jurisdiction() || institution.jurisdiction === this.jurisdiction()) &&
      (!this.state() || institution.state === this.state())
    );
  }

  private matchesText(text: string): boolean {
    const normalized = normalizeOfficialSearch(text);
    return normalizeOfficialSearch(this.query())
      .trim()
      .split(/\s+/u)
      .every((word) => normalized.includes(word));
  }

  jurisdictionLabel(value: string): string {
    return (
      (
        { FEDERAL: 'Federal', ESTADUAL: 'Estadual', MUNICIPAL: 'Municipal' } as Record<
          string,
          string
        >
      )[value] ?? value
    );
  }

  goToPage(value: number): void {
    if (value < 1 || value > this.pageCount()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: value === 1 ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  changeState(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { uf: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient, { optional: true });
  private readonly environment = inject(PUBLIC_ENVIRONMENT, { optional: true });
  private subscription: Subscription | null = null;
  private feedSubscription: Subscription | null = null;

  constructor() {
    this.institutionsView = this.route.snapshot.data['officialView'] === 'institutions';
  }

  ngOnInit(): void {
    if (this.http && this.environment && !this.institutionsView) {
      const baseUrl = this.environment.apiBaseUrl.replace(/\/$/u, '');
      this.feedSubscription = this.http
        .get<{ items: unknown[]; checkedAt: string | null }>(`${baseUrl}/api/v1/official-feed`)
        .subscribe({
          next: (feed) => {
            if (!Array.isArray(feed.items)) return;
            this.refreshedListings.set(feed.items.filter(isOfficialListing));
            this.refreshedAt.set(feed.checkedAt);
          },
          error: () => undefined,
        });
    }
    this.subscription = this.route.queryParamMap.subscribe((params) => {
      const query = params.get('q') ?? '';
      this.query.set(query);
      this.typedQuery.set(query);
      const uf = params.get('uf') ?? '';
      this.state.set(this.states.includes(uf) ? uf : '');
      const page = Number(params.get('page'));
      this.page.set(Number.isSafeInteger(page) && page > 0 ? page : 1);
      const jurisdiction = params.get('jurisdiction');
      this.jurisdiction.set(
        ['FEDERAL', 'ESTADUAL', 'MUNICIPAL'].includes(jurisdiction ?? '') ? jurisdiction! : '',
      );
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.feedSubscription?.unsubscribe();
  }

  submit(event: Event): void {
    event.preventDefault();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.typedQuery().trim() || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  changeJurisdiction(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { jurisdiction: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  institutionName(acronym: string): string {
    return OFFICIAL_INSTITUTIONS.find((item) => item.acronym === acronym)?.name ?? acronym;
  }
}
