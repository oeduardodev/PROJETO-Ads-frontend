import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AdminSessionService } from './admin-session.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AdminSessionService);
  const router = inject(Router);
  return (await session.accessToken())
    ? true
    : router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
};
