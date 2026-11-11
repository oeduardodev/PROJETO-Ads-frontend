import { Routes } from '@angular/router';
import { adminGuard } from './features/admin/admin.guard';

export const routes: Routes = [
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/admin-login').then((module) => module.AdminLogin),
    title: 'Acesso à curadoria — Além do SiSU',
    data: { description: 'Acesso restrito à equipe de curadoria.', indexable: false },
  },
  {
    path: 'admin/callback',
    loadComponent: () =>
      import('./features/admin/admin-callback').then((module) => module.AdminCallback),
    title: 'Validando acesso — Além do SiSU',
    data: { description: 'Validação de acesso à área de curadoria.', indexable: false },
  },
  {
    path: 'admin',
    title: 'Administração — Além do SiSU',
    data: { description: 'Área restrita de revisão e gestão de fontes.', indexable: false },
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
    path: 'oportunidades/:id',
    loadComponent: () =>
      import('./features/opportunities/detail/opportunity-detail').then(
        (module) => module.OpportunityDetail,
      ),
    title: 'Detalhes do processo — Além do SiSU',
    data: {
      description:
        'Consulte informações verificadas, prazos, requisitos e fontes oficiais do processo.',
      indexable: false,
    },
  },
  {
    path: 'oportunidades',
    loadComponent: () =>
      import('./features/opportunities/list/opportunity-list').then(
        (module) => module.OpportunityList,
      ),
    title: 'Explorar oportunidades — Além do SiSU',
    data: {
      description:
        'Explore processos seletivos públicos para graduação e consulte as fontes oficiais.',
      indexable: true,
    },
  },
  {
    path: 'instituicoes',
    loadComponent: () =>
      import('./features/institutions/institution-directory').then(
        (module) => module.InstitutionDirectory,
      ),
    title: 'Instituições verificadas — Além do SiSU',
    data: {
      description:
        'Consulte instituições públicas verificadas e a cobertura conhecida de suas fontes oficiais.',
      indexable: true,
    },
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((module) => module.Home),
    title: 'Além do SiSU — outras formas de entrar na universidade pública',
    data: {
      description:
        'Descubra outras formas verificáveis de ingressar em instituições públicas de ensino superior.',
      indexable: true,
    },
  },
  { path: '**', redirectTo: '' },
];
