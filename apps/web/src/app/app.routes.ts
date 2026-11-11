import { Routes } from '@angular/router';
import { adminGuard } from './features/admin/admin.guard';

export const routes: Routes = [
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/admin-login').then((module) => module.AdminLogin),
    title: 'Acesso à curadoria — Além do SiSU',
  },
  {
    path: 'admin/callback',
    loadComponent: () =>
      import('./features/admin/admin-callback').then((module) => module.AdminCallback),
    title: 'Validando acesso — Além do SiSU',
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    loadComponent: () => import('./features/admin/admin-shell').then((module) => module.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'reviews' },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./features/admin/reviews/admin-review-workspace').then(
            (module) => module.AdminReviewWorkspace,
          ),
      },
      {
        path: 'reviews/:id',
        loadComponent: () =>
          import('./features/admin/reviews/admin-review-workspace').then(
            (module) => module.AdminReviewWorkspace,
          ),
      },
      {
        path: 'sources',
        loadComponent: () =>
          import('./features/admin/sources/admin-source-dashboard').then(
            (module) => module.AdminSourceDashboard,
          ),
      },
    ],
  },
  {
    path: 'oportunidades',
    loadComponent: () =>
      import('./features/home/opportunities-preview').then((module) => module.OpportunitiesPreview),
    title: 'Explorar oportunidades — Além do SiSU',
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((module) => module.Home),
    title: 'Além do SiSU — outras formas de entrar na universidade pública',
  },
  { path: '**', redirectTo: '' },
];
