import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layout/shell/shell';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'plan',
        loadComponent: () =>
          import('./features/plan/plan.component').then(m => m.PlanComponent),
      },
      {
        path: 'forecast',
        loadComponent: () =>
          import('./features/forecast/forecast.component').then(m => m.ForecastComponent),
      },
      {
        path: 'bom',
        loadComponent: () =>
          import('./features/bom/bom.component').then(m => m.BomComponent),
      },
      {
        path: 'kits',
        loadComponent: () =>
          import('./features/kits/kits.component').then(m => m.KitsComponent),
      },
      {
        path: 'conteos',
        loadComponent: () =>
          import('./features/conteos/conteos.component').then(m => m.ConteosComponent),
      },
      {
        path: 'production',
        loadComponent: () =>
          import('./features/production/production.component').then(m => m.ProductionComponent),
      },
      {
        path: 'monitor',
        loadComponent: () =>
          import('./features/monitor/monitor.component').then(m => m.MonitorComponent),
      },
      {
        path: 'visual-aids',
        loadComponent: () =>
          import('./features/visual-aids/visual-aids.component').then(m => m.VisualAidsComponent),
      },
      {
        path: 'disposition',
        loadComponent: () =>
          import('./features/disposition/disposition.component').then(m => m.DispositionComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
