import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PUBLIC_ENVIRONMENT } from '../../core/public-environment';
import { adminGuard } from './admin.guard';
import { AdminSessionService, safeAdminReturnUrl } from './admin-session.service';
import { AdminLogin } from './admin-login';
import { AdminShell } from './admin-shell';

function evaluateGuard(accessToken: string | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminSessionService, useValue: { accessToken: async () => accessToken } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    adminGuard({} as ActivatedRouteSnapshot, { url: '/admin/reviews' } as RouterStateSnapshot),
  );
}

describe('admin shell session', () => {
  it('redirects unauthenticated navigation to login with an internal return URL', async () => {
    const result = await evaluateGuard(null);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/admin/login?returnUrl=%2Fadmin%2Freviews',
    );
  });

  it('lets a session with an access token reach the administrative shell', async () => {
    expect(await evaluateGuard('opaque-test-token')).toBe(true);
  });

  it('does not expose a login action before an identity provider is configured', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PUBLIC_ENVIRONMENT, useValue: { adminOidc: null } },
        AdminSessionService,
      ],
    });
    const session = TestBed.inject(AdminSessionService);
    expect(session.configured).toBe(false);
    expect(session.state()).toBe('unconfigured');
    expect(await session.accessToken()).toBeNull();
  });

  it('keeps callback return paths inside the admin routes', () => {
    expect(safeAdminReturnUrl('/admin/sources?page=2')).toBe('/admin/sources?page=2');
    expect(safeAdminReturnUrl('/admin/../public')).toBe('/admin/reviews');
    expect(safeAdminReturnUrl('https://elsewhere.invalid/admin')).toBe('/admin/reviews');
    expect(safeAdminReturnUrl('/admin/callback')).toBe('/admin/reviews');
  });

  it('shows an explicit unavailable state when no provider is configured', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLogin],
      providers: [
        provideRouter([]),
        { provide: PUBLIC_ENVIRONMENT, useValue: { adminOidc: null } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminLogin);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('provedor de identidade administrativa');
    expect(page.querySelector('button')).toBeNull();
  });

  it('provides labeled review and source navigation in the protected shell', async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [
        provideRouter([]),
        { provide: AdminSessionService, useValue: { signOut: async () => undefined } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const nav = page.querySelector('nav[aria-label="Navegação da curadoria"]');
    expect(nav?.querySelector('a[href="/admin/reviews"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/admin/sources"]')).not.toBeNull();
  });
});
