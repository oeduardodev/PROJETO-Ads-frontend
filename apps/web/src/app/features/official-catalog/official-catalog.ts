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

const OFFICIAL_CATEGORIES = [
  'Reopção',
  'Transferência',
  'Ingresso de graduados',
  'Processo Seletivo Especial',
] as const;

interface FeedSourceStatus {
  key: string;
  acronym: string;
  state: string;
  method?: string;
  error?: string | null;
  lastAttempt?: string;
  lastSuccess?: string;
}

function isFeedSourceStatus(value: unknown): value is FeedSourceStatus {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FeedSourceStatus>;
  return (
    typeof item.key === 'string' &&
    typeof item.acronym === 'string' &&
    typeof item.state === 'string' &&
    (!item.error || typeof item.error === 'string')
  );
}

function listingInstitution(item: Partial<OfficialListing>): OfficialInstitution | undefined {
  if (Number.isSafeInteger(item.institutionId)) {
    return OFFICIAL_INSTITUTIONS.find((institution) => institution.id === item.institutionId);
  }
  return OFFICIAL_INSTITUTIONS.find(
    (institution) => institution.acronym === item.institution && institution.selectionsUrl,
  );
}

function isOfficialListing(value: unknown): value is OfficialListing {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OfficialListing>;
  if (!item.institution || typeof item.title !== 'string' || typeof item.url !== 'string') {
    return false;
  }
  try {
    const url = new URL(item.url);
    const institution = listingInstitution(item);
    if (!institution || item.institution !== institution.acronym) return false;
    const allowedHosts = [institution.websiteUrl, institution.selectionsUrl]
      .filter((value): value is string => !!value)
      .map((value) => new URL(value).hostname);
    return (
      url.protocol === 'https:' &&
      allowedHosts.includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port &&
      OFFICIAL_CATEGORIES.includes(item.category as OfficialListing['category']) &&
      item.title.length >= 8 &&
      (!item.state || item.state === institution.state) &&
      (!item.pageKind || ['edital', 'selection_page'].includes(item.pageKind)) &&
      (!item.checkedAt || Number.isFinite(Date.parse(item.checkedAt)))
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
  readonly category = signal('');
  readonly page = signal(1);
  readonly pageSize = 24;
  readonly states = [...new Set(OFFICIAL_INSTITUTIONS.map((item) => item.state))].sort();
  readonly totalInstitutions = OFFICIAL_INSTITUTIONS.length;
  readonly auditedWebsiteCount = OFFICIAL_INSTITUTIONS.filter((item) => item.websiteUrl).length;
  readonly refreshedAt = signal<string | null>(null);
  readonly sourceStatuses = signal<FeedSourceStatus[]>([]);
  readonly sourceErrorCount = computed(
    () => this.sourceStatuses().filter((source) => source.error).length,
  );
  readonly staticListings = signal<OfficialListing[]>([]);
  readonly refreshedListings = signal<OfficialListing[]>([]);
  readonly allListings = computed(() => {
    const merged = new Map<string, OfficialListing>();
    for (const listing of [
      ...OFFICIAL_LISTINGS,
      ...this.staticListings(),
      ...this.refreshedListings(),
    ]) {
      const previous = merged.get(listing.url);
      if (
        !previous ||
        (Date.parse(listing.checkedAt ?? '') || 0) > (Date.parse(previous.checkedAt ?? '') || 0)
      ) {
        merged.set(listing.url, listing);
      }
    }
    return [...merged.values()];
  });
  readonly institutions = computed(() =>
    OFFICIAL_INSTITUTIONS.filter((institution) => {
      if (!this.matchesLocation(institution)) return false;
      if (
        !this.institutionsView &&
        this.category() &&
        !this.allListings().some(
          (listing) =>
            listingInstitution(listing)?.id === institution.id &&
            listing.category === this.category(),
        )
      )
        return false;
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
    return this.institutions().filter((item) => item.selectionsUrl || item.websiteUrl);
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
      const institution = listingInstitution(listing);
      return (
        institution &&
        this.matchesLocation(institution) &&
        (!this.category() || listing.category === this.category()) &&
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
  private staticFeedSubscription: Subscription | null = null;

  constructor() {
    this.institutionsView = this.route.snapshot.data['officialView'] === 'institutions';
  }

  ngOnInit(): void {
    if (this.http && this.environment && !this.institutionsView) {
      this.staticFeedSubscription = this.http
        .get<{ items: unknown[]; checkedAt: string | null; sources?: unknown[] }>(
          '/official-feed.json',
        )
        .subscribe({
          next: (feed) => {
            if (!Array.isArray(feed.items)) return;
            this.staticListings.set(feed.items.filter(isOfficialListing));
            if (Array.isArray(feed.sources)) {
              this.sourceStatuses.set(feed.sources.filter(isFeedSourceStatus));
            }
            if (feed.checkedAt) this.refreshedAt.set(feed.checkedAt);
          },
          error: () => undefined,
        });
      const baseUrl = this.environment.apiBaseUrl.replace(/\/$/u, '');
      this.feedSubscription = this.http
        .get<{ items: unknown[]; checkedAt: string | null }>(`${baseUrl}/api/v1/official-feed`)
        .subscribe({
          next: (feed) => {
            if (!Array.isArray(feed.items)) return;
            this.refreshedListings.set(feed.items.filter(isOfficialListing));
            if (
              feed.checkedAt &&
              (!this.refreshedAt() || Date.parse(feed.checkedAt) > Date.parse(this.refreshedAt()!))
            )
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
      const category = params.get('category') ?? '';
      this.category.set(
        OFFICIAL_CATEGORIES.includes(category as OfficialListing['category']) ? category : '',
      );
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
    this.staticFeedSubscription?.unsubscribe();
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

  changeCategory(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  institutionName(acronym: string, institutionId?: number): string {
    return (
      OFFICIAL_INSTITUTIONS.find((item) =>
        institutionId ? item.id === institutionId : item.acronym === acronym,
      )?.name ?? acronym
    );
  }
}
