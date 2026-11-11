import { Injectable, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { PUBLIC_ENVIRONMENT } from '../public-environment';
import { createPublicApiClient, resolvePublicApiBaseUrl } from './public-api-client';
import { getProcess, listFilters, listInstitutions, searchProcesses } from './generated';
import type {
  GetProcessData,
  InstitutionList,
  ListFiltersData,
  SearchProcessesData,
  Filters,
  ProcessDetail,
  ProcessList,
} from './generated';

@Injectable({ providedIn: 'root' })
export class PublicCatalogService {
  private readonly environment = inject(PUBLIC_ENVIRONMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = resolvePublicApiBaseUrl(
    this.environment.apiBaseUrl,
    isPlatformBrowser(this.platformId)
      ? globalThis.location.origin
      : this.environment.publicSiteUrl,
  );
  private readonly client = createPublicApiClient(this.baseUrl);

  async search(query?: SearchProcessesData['query'], signal?: AbortSignal): Promise<ProcessList> {
    const result = await searchProcesses({
      client: this.client,
      query,
      signal,
      throwOnError: true,
    });
    return result.data;
  }

  async get(id: GetProcessData['path']['id'], signal?: AbortSignal): Promise<ProcessDetail> {
    const result = await getProcess({
      client: this.client,
      path: { id },
      signal,
      throwOnError: true,
    });
    return result.data;
  }

  async filters(query?: ListFiltersData['query'], signal?: AbortSignal): Promise<Filters> {
    const result = await listFilters({
      client: this.client,
      query,
      signal,
      throwOnError: true,
    });
    return result.data;
  }

  async institutions(page = 1, pageSize = 25, signal?: AbortSignal): Promise<InstitutionList> {
    const result = await listInstitutions({
      client: this.client,
      query: { page, page_size: pageSize },
      signal,
      throwOnError: true,
    });
    return result.data;
  }
}
