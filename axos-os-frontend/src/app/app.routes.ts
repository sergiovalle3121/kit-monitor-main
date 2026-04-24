import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layout/shell/shell';
import { authGuard } from './core/auth.guard';
import { workspaceRouteData } from './layout/shell/workspace-route-meta';

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
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/kits/kits.component').then(m => m.KitsComponent),
      },
      {
        path: 'materials/cycle-counts',
        data: workspaceRouteData('materials'),
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
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/production/production.component').then(m => m.ProductionComponent),
      },

      {
        path: 'production/hourly',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/production-hourly/production-hourly.component').then(m => m.ProductionHourlyComponent),
      },
      {
        path: 'production/completed',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/production-completed/production-completed.component').then(m => m.ProductionCompletedComponent),
      },
      {
        path: 'materials/inventory',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/inventory-explorer/inventory-explorer.component').then(m => m.InventoryExplorerComponent),
      },
      {
        path: 'materials/resupply',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/materials-resupply-control/materials-resupply-control.component').then(m => m.MaterialsResupplyControlComponent),
      },
      {
        path: 'production/logistics',
        redirectTo: 'materials/resupply',
        pathMatch: 'full',
      },
      {
        path: 'site-overview',
        loadComponent: () =>
          import('./features/site-overview/site-overview.component').then(m => m.SiteOverviewComponent),
      },
      {
        path: 'control-tower',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/control-tower/control-tower.component').then(m => m.ControlTowerComponent),
      },
      {
        path: 'monitor',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/monitor/monitor.component').then(m => m.MonitorComponent),
      },
      {
        path: 'exception-center',
        loadComponent: () =>
          import('./features/exception-center/exception-center.component').then(m => m.ExceptionCenterComponent),
      },
      {
        path: 'visual-aids',
        loadComponent: () =>
          import('./features/engineering/visual-aids/visual-aids.component').then(m => m.VisualAidsComponent),
      },
      {
        path: 'plant-layout',
        loadComponent: () =>
          import('./features/engineering/plant-layout/plant-layout.component').then(m => m.PlantLayoutComponent),
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
        path: 'iqc-center',
        loadComponent: () =>
          import('./features/iqc-center/iqc-center.component').then(m => m.IqcCenterComponent),
      },
      {
        path: 'scar-center',
        loadComponent: () =>
          import('./features/scar-center/scar-center.component').then(m => m.ScarCenterComponent),
      },
      {
        path: 'supplier-scorecard',
        loadComponent: () =>
          import('./features/supplier-scorecard/supplier-scorecard.component').then(m => m.SupplierScorecardComponent),
      },
      {
        path: 'receiving-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/receiving-center/receiving-center.component').then(m => m.ReceivingCenterComponent),
      },
      {
        path: 'warehouse-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/warehouse-center/warehouse-center.component').then(m => m.WarehouseCenterComponent),
      },
      {
        path: 'replenishment-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/replenishment-center/replenishment-center.component').then(m => m.ReplenishmentCenterComponent),
      },
      {
        path: 'picking-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/picking-center/picking-center.component').then(m => m.PickingCenterComponent),
      },
      {
        path: 'scheduling-center',
        loadComponent: () =>
          import('./features/scheduling-center/scheduling-center.component').then(m => m.SchedulingCenterComponent),
      },
      {
        path: 'production-wip',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/production-wip/production-wip.component').then(m => m.ProductionWipComponent),
      },
      {
        path: 'fg-center',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/fg-center/fg-center.component').then(m => m.FgCenterComponent),
      },
      {
        path: 'oqc-center',
        loadComponent: () =>
          import('./features/oqc-center/oqc-center.component').then(m => m.OqcCenterComponent),
      },
      {
        path: 'shipping-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/shipping-center/shipping-center.component').then(m => m.ShippingCenterComponent),
      },
      {
        path: 'admin-center',
        loadComponent: () =>
          import('./features/admin-center/admin-center.component').then(m => m.AdminCenterComponent),
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
