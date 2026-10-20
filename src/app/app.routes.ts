import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'links',
    loadComponent: () => import('./pages/links/links.component').then(m => m.LinksComponent),
  },
  {
    path: 'story',
    loadComponent: () => import('./pages/story/story.component').then(m => m.StoryComponent),
  },
  {
    path: 'bio',
    redirectTo: 'links',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
