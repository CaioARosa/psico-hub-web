import { Routes } from '@angular/router';

import { provideZardCharts } from '@/shared/components/chart';
import { legacyRedirect } from './admin-redirects';
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
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      {
        path: 'inicio',
        loadComponent: () => import('./inicio/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'atendimentos',
        loadComponent: () =>
          import('./atendimentos/atendimentos.component').then(m => m.AtendimentosComponent),
      },
      {
        path: 'agenda',
        redirectTo: legacyRedirect('agenda'),
      },
      {
        path: 'painel',
        redirectTo: legacyRedirect('painel'),
      },
      {
        path: 'pacientes',
        loadComponent: () => import('./patients/patients.component').then(m => m.PatientsComponent),
      },
      {
        path: 'sessoes',
        redirectTo: legacyRedirect('sessoes'),
      },
      {
        path: 'pagamentos',
        redirectTo: legacyRedirect('pagamentos'),
      },
      {
        path: 'financeiro',
        loadComponent: () =>
          import('./financeiro/finance-hub.component').then(m => m.FinanceHubComponent),
      },
      {
        path: 'cobranca',
        redirectTo: legacyRedirect('cobranca'),
      },
    ],
  },
];
