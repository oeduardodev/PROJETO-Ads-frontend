import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((module) => module.Home),
    title: 'Além do SiSU — outras formas de entrar na universidade pública',
  },
  { path: '**', redirectTo: '' },
];
