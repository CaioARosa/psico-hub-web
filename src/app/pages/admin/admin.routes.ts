import { Routes } from '@angular/router';

import { provideZardCharts } from '@/shared/components/chart';
import { authGuard } from './data/auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    providers: [provideZardCharts()],
    loadComponent: () => import('./admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'sessoes', pathMatch: 'full' },
      {
        path: 'painel',
        loadComponent: () => import('./painel/dashboard.component').then(m => m.DashboardComponent),
      },
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
