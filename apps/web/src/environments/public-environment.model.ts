export interface PublicEnvironment {
  apiBaseUrl: string;
  publicSiteUrl: string;
  catalogEnabled: boolean;
  adminOidc: {
    authority: string;
    clientId: string;
    scope: string;
    audience?: string;
  } | null;
}
