import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
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
          import('./pages/plan/plan.component').then(m => m.PlanComponent),
      },
      {
        path: 'bom',
        loadComponent: () =>
          import('./pages/bom/bom.component').then(m => m.BomComponent),
      },
      {
        path: 'kits',
        loadComponent: () =>
          import('./pages/kits/kits.component').then(m => m.KitsComponent),
      },
      {
        path: 'monitor',
        loadComponent: () =>
          import('./pages/monitor/monitor.component').then(m => m.MonitorComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
