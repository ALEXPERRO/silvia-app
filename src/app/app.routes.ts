import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Blooming Wild ART — About me',
  },
  {
    path: 'portfolio',
    loadComponent: () => import('./features/portfolio/portfolio').then((m) => m.Portfolio),
    title: 'Blooming Wild ART — Portfolio',
  },
  {
    path: 'eventi',
    loadComponent: () => import('./features/eventi/eventi').then((m) => m.Eventi),
    title: 'Blooming Wild ART — Eventi',
  },
  {
    path: 'shop',
    loadComponent: () => import('./features/shop/shop').then((m) => m.Shop),
    title: 'Blooming Wild ART — Shop',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
