import { Routes } from '@angular/router';

import { authGuard } from './data/auth.guard';

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
      { path: '', redirectTo: 'sessoes', pathMatch: 'full' },
      {
        path: 'pacientes',
        loadComponent: () => import('./patients/patients.component').then(m => m.PatientsComponent),
      },
      {
        path: 'sessoes',
        loadComponent: () => import('./sessions/sessions.component').then(m => m.SessionsComponent),
      },
      {
        path: 'pagamentos',
        loadComponent: () => import('./pagamentos/payments.component').then(m => m.PaymentsComponent),
      },
      {
        path: 'financeiro',
        loadComponent: () => import('./financeiro/finance.component').then(m => m.FinanceComponent),
      },
    ],
  },
];
