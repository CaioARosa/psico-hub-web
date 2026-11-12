import { Routes } from '@angular/router';

import { authGuard } from './data/auth.guard';

// Task 8 acrescenta `sessoes` e muda o redirect vazio.
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'pacientes', pathMatch: 'full' },
      {
        path: 'pacientes',
        loadComponent: () => import('./patients/patients.component').then(m => m.PatientsComponent),
      },
    ],
  },
];
