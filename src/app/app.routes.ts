import { Routes } from '@angular/router';
import { eventoResolver } from './features/evento-dettaglio/evento-dettaglio.resolver';

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
    path: 'eventi/:slugId',
    loadComponent: () => import('./features/evento-dettaglio/evento-dettaglio').then((m) => m.EventoDettaglio),
    resolve: { event: eventoResolver },
  },
  {
    path: 'shop',
    loadComponent: () => import('./features/shop/shop').then((m) => m.Shop),
    title: 'Blooming Wild ART — Shop',
  },
  {
    path: 'gestione-prenotazioni',
    loadComponent: () => import('./features/gestione/gestione').then((m) => m.Gestione),
    title: 'Blooming Wild ART — Gestione',
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
