import { Routes } from '@angular/router';

import { authGuard } from './data/auth.guard';

// Tasks 7 e 8 acrescentam `pacientes`, `sessoes` e o redirect vazio aos filhos do shell.
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./admin-shell.component').then(m => m.AdminShellComponent),
    children: [],
  },
];
