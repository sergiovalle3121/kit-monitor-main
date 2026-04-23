import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layout/shell/shell';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
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
        path: 'materials/cycle-counts',
        loadComponent: () =>
          import('./features/conteos/conteos.component').then(m => m.ConteosComponent),
      },
      {
        path: 'conteos',
        redirectTo: 'materials/cycle-counts',
        pathMatch: 'full',
      },
      {
        path: 'production',
        loadComponent: () =>
          import('./features/production/production.component').then(m => m.ProductionComponent),
      },

      {
        path: 'production/hourly',
        loadComponent: () =>
          import('./features/production-hourly/production-hourly.component').then(m => m.ProductionHourlyComponent),
      },
      {
        path: 'production/completed',
        loadComponent: () =>
          import('./features/production-completed/production-completed.component').then(m => m.ProductionCompletedComponent),
      },
      {
        path: 'materials/inventory',
        loadComponent: () =>
          import('./features/inventory-explorer/inventory-explorer.component').then(m => m.InventoryExplorerComponent),
      },
      {
        path: 'materials/resupply',
        loadComponent: () =>
          import('./features/materials-resupply-control/materials-resupply-control.component').then(m => m.MaterialsResupplyControlComponent),
      },
      {
        path: 'production/logistics',
        redirectTo: 'materials/resupply',
        pathMatch: 'full',
      },
      {
        path: 'control-tower',
        loadComponent: () =>
          import('./features/control-tower/control-tower.component').then(m => m.ControlTowerComponent),
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

      {
        path: 'quality-center',
        loadComponent: () =>
          import('./features/quality-center/quality-center.component').then(m => m.QualityCenterComponent),
      },
      {
        path: 'ncr-center',
        loadComponent: () =>
          import('./features/ncr-center/ncr-center.component').then(m => m.NcrCenterComponent),
      },
      {
        path: 'capa-center',
        loadComponent: () =>
          import('./features/capa-center/capa-center.component').then(m => m.CapaCenterComponent),
      },
      {
        path: 'roadmap/:domain/:module',
        loadComponent: () =>
          import('./features/enterprise-placeholder/enterprise-placeholder.component').then(m => m.EnterprisePlaceholderComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
