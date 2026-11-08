import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { PUBLIC_ENVIRONMENT } from '../../core/public-environment';

export type AdminSessionState =
  'unconfigured' | 'anonymous' | 'authenticating' | 'authenticated' | 'expired' | 'error';

export function safeAdminReturnUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return '/admin/reviews';
  }
  let parsed: URL;
  try {
    parsed = new URL(value, 'https://admin.local');
  } catch {
    return '/admin/reviews';
  }
  if (
    parsed.origin !== 'https://admin.local' ||
    !/^\/admin(?:\/|$)/u.test(parsed.pathname) ||
    /^\/admin\/(?:login|callback)(?:\/|$)/u.test(parsed.pathname)
  ) {
    return '/admin/reviews';
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  private readonly environment = inject(PUBLIC_ENVIRONMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly manager = this.createManager();

  readonly state = signal<AdminSessionState>(this.manager ? 'anonymous' : 'unconfigured');

  get configured(): boolean {
    return this.manager !== null;
  }

  async accessToken(): Promise<string | null> {
    if (!this.manager) return null;
    try {
      const user = await this.manager.getUser();
      if (!user) {
        if (this.state() !== 'error') this.state.set('anonymous');
        return null;
      }
      if (user.expired || !user.access_token) {
        await this.manager.removeUser();
        this.state.set('expired');
        return null;
      }
      this.state.set('authenticated');
      return user.access_token;
    } catch {
      this.state.set('error');
      return null;
    }
  }

  async beginLogin(returnUrl: unknown): Promise<void> {
    if (!this.manager) throw new Error('Administrative identity provider is not configured');
    this.state.set('authenticating');
    try {
      await this.manager.signinRedirect({ state: { returnUrl: safeAdminReturnUrl(returnUrl) } });
    } catch {
      this.state.set('error');
      throw new Error('Administrative sign-in could not start');
    }
  }

  async completeLogin(): Promise<string> {
    if (!this.manager) throw new Error('Administrative identity provider is not configured');
    this.state.set('authenticating');
    try {
      const user = await this.manager.signinRedirectCallback();
      if (!user.access_token || user.expired) throw new Error('Missing or expired access token');
      this.state.set('authenticated');
      const state = user.state;
      return safeAdminReturnUrl(
        state && typeof state === 'object' && 'returnUrl' in state ? state.returnUrl : null,
      );
    } catch {
      this.state.set('error');
      throw new Error('Administrative sign-in could not be completed');
    }
  }

  async signOut(): Promise<void> {
    if (this.manager) await this.manager.removeUser();
    this.state.set(this.manager ? 'anonymous' : 'unconfigured');
  }

  private createManager(): UserManager | null {
    const config = this.environment.adminOidc;
    if (!isPlatformBrowser(this.platformId) || !config) return null;
    let authority: URL;
    try {
      authority = new URL(config.authority);
    } catch {
      return null;
    }
    if (authority.protocol !== 'https:' || !config.clientId.trim() || !config.scope.trim()) {
      return null;
    }
    return new UserManager({
      authority: authority.toString(),
      client_id: config.clientId,
      redirect_uri: `${window.location.origin}/admin/callback`,
      response_type: 'code',
      scope: config.scope,
      automaticSilentRenew: false,
      loadUserInfo: false,
      userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
      stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
      ...(config.audience ? { extraQueryParams: { audience: config.audience } } : {}),
    });
  }
}
