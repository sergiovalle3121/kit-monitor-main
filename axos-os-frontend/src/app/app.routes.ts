import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { ShellComponent } from './layout/shell/shell';
import { FocusedLayoutComponent } from './layout/focused-layout/focused-layout';
import { authGuard } from './core/auth.guard';
import { contextGuard } from './core/context.guard';
import { workspaceRouteData } from './layout/shell/workspace-route-meta';
import { ContextGateComponent } from './features/context-gate/context-gate.component';

export const routes: Routes = [

  // ── Public routes ───────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  { path: 'login', component: LoginComponent },
  { path: 'context-gate', component: ContextGateComponent, canActivate: [authGuard] },

  // ── MainLayout: Shell (Sidebar + Header + Content) ──────────────────────
  // Dashboard and all standard-navigation modules live here.
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard, contextGuard],
    canActivateChild: [authGuard, contextGuard],
    children: [

      // Mission Control Dashboard — landing post-login
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      // Planning & Program
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
        path: 'scheduling-center',
        loadComponent: () =>
          import('./features/scheduling-center/scheduling-center.component').then(m => m.SchedulingCenterComponent),
      },

      // Engineering
      {
        path: 'bom',
        loadComponent: () =>
          import('./features/bom/bom.component').then(m => m.BomComponent),
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

      // Materials & Supply Chain
      {
        path: 'materials/inventory',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/inventory-explorer/inventory-explorer.component').then(m => m.InventoryExplorerComponent),
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
        path: 'kits',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/kits/kits.component').then(m => m.KitsComponent),
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
        path: 'picking-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/picking-center/picking-center.component').then(m => m.PickingCenterComponent),
      },
      {
        path: 'shipping-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/shipping-center/shipping-center.component').then(m => m.ShippingCenterComponent),
      },
      {
        path: 'replenishment-center',
        data: workspaceRouteData('materials'),
        loadComponent: () =>
          import('./features/replenishment-center/replenishment-center.component').then(m => m.ReplenishmentCenterComponent),
      },

      // Production & MES
      {
        path: 'control-tower',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/control-tower/control-tower.component').then(m => m.ControlTowerComponent),
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
        path: 'production-wip',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/production-wip/production-wip.component').then(m => m.ProductionWipComponent),
      },
      {
        path: 'monitor',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/monitor/monitor.component').then(m => m.MonitorComponent),
      },
      {
        path: 'fg-center',
        data: workspaceRouteData('production'),
        loadComponent: () =>
          import('./features/fg-center/fg-center.component').then(m => m.FgCenterComponent),
      },

      // Executive / Command
      {
        path: 'site-overview',
        loadComponent: () =>
          import('./features/site-overview/site-overview.component').then(m => m.SiteOverviewComponent),
      },
      {
        path: 'exception-center',
        loadComponent: () =>
          import('./features/exception-center/exception-center.component').then(m => m.ExceptionCenterComponent),
      },

      // Quality
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
        path: 'oqc-center',
        loadComponent: () =>
          import('./features/oqc-center/oqc-center.component').then(m => m.OqcCenterComponent),
      },
      {
        path: 'supplier-scorecard',
        loadComponent: () =>
          import('./features/supplier-scorecard/supplier-scorecard.component').then(m => m.SupplierScorecardComponent),
      },

      // Admin
      {
        path: 'admin-center',
        loadComponent: () =>
          import('./features/admin-center/admin-center.component').then(m => m.AdminCenterComponent),
      },

      // Enterprise roadmap placeholder
      {
        path: 'roadmap/:domain/:module',
        loadComponent: () =>
          import('./features/enterprise-placeholder/enterprise-placeholder.component').then(m => m.EnterprisePlaceholderComponent),
      },
    ],
  },

  // ── FocusedLayout: Full-Screen (no Sidebar, no Header) ─────────────────
  // High-focus editing and design modules. Fade-in/out 0.3s via CSS animation.
  {
    path: '',
    component: FocusedLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
    ],
  },

  // ── Fallback ────────────────────────────────────────────────────────────
  { path: '**', redirectTo: 'login' },
];
