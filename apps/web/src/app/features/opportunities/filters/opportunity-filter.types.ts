export type OpportunitySort = 'recent' | 'deadline' | 'course';
export type EnemFilter = '' | 'true' | 'false' | 'unknown';

export interface OpportunityFilterState {
  q: string;
  uf: string;
  city: string;
  degree: string;
  modality: string;
  requiresEnem: EnemFilter;
  type: string;
  openOnly: boolean;
  sort: OpportunitySort;
}

export type OpportunityFilterPatch = Partial<OpportunityFilterState>;

export const DEFAULT_OPPORTUNITY_FILTERS: OpportunityFilterState = {
  q: '',
  uf: '',
  city: '',
  degree: '',
  modality: '',
  requiresEnem: '',
  type: '',
  openOnly: false,
  sort: 'recent',
};
