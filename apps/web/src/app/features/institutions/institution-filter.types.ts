import type { Institution } from '../../core/api/generated';

export type DirectoryJurisdiction = '' | Institution['jurisdiction'];
export interface DirectoryFilters {
  q: string;
  uf: string;
  city: string;
  jurisdiction: DirectoryJurisdiction;
}
export type DirectoryFilterPatch = Partial<DirectoryFilters>;
