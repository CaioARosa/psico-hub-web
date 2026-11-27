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
        path: 'agenda',
        loadComponent: () => import('./agenda/agenda.component').then(m => m.AgendaComponent),
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
      {
        path: 'cobranca',
        loadComponent: () => import('./cobranca/cobranca.component').then(m => m.CobrancaComponent),
      },
    ],
  },
];
