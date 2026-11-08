import type { PublicEnvironment } from './public-environment.model';

// Public values only: Angular compiles this object into the browser bundle.
export const environment: PublicEnvironment = {
  apiBaseUrl: '',
  publicSiteUrl: '',
  catalogEnabled: false,
  adminOidc: null,
};
