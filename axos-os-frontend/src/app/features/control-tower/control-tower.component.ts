import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { forkJoin, interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import {
  Building, Campus, CampusKpi, CampusState, Customer, DomainHealth,
  EnterpriseException, ProgramSummary, RiskLevel, Shift, Warehouse
} from '../../core/enterprise.model';

@Component({
  selector: 'app-control-tower',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './control-tower.component.html',
  styleUrls: ['./control-tower.component.css'],
})
export class ControlTowerComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';

  // Active filter dimensions
  filterBuilding = 'all';
  filterCustomer = 'all';
  filterProgram  = 'all';
  filterRisk     = 'all';

  // Active campus view mode
  activeView: 'campus' | 'buildings' | 'warehouses' | 'programs' = 'campus';

  // Campus state (derives from real APIs, expands with real campus endpoints in Phase 2)
  campusState!: CampusState;
  lastUpdated = '';

  private refreshSub?: Subscription;
  private backends: any[] = [];
  private kits: any[]     = [];
  private publications: any[] = [];
  private cancellations: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.refreshSub = interval(30_000)
      .pipe(startWith(0), switchMap(() => this.fetchAll()))
      .subscribe({
        next: (data) => {
          this.backends      = data.backends      ?? [];
          this.kits          = data.kits          ?? [];
          this.publications  = data.publications  ?? [];
          this.cancellations = data.cancellations ?? [];
          this.campusState   = this.buildCampusState();
          this.lastUpdated   = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          this.loading = false;
        },
        error: () => {
          this.error = 'No se pudo conectar con el servidor.';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void { this.refreshSub?.unsubscribe(); }

  private fetchAll() {
    return forkJoin({
      backends:      this.api.getProductionBackends(),
      kits:          this.api.getKits(),
      publications:  this.api.getPlanPublications(),
      cancellations: this.api.getRecentCancellationRequests(),
    });
  }

  // ── Campus State Builder ─────────────────────────────────────────────────────
  // Phase 1: derives campus structure from existing API data.
  // Phase 2+: will merge with real /campus, /buildings, /warehouses, /programs APIs.
  private buildCampusState(): CampusState {
    const shift = this.currentShift();
    const buildings = this.buildBuildingCards();
    const warehouses = this.buildWarehouseNodes();
    const customers  = this.buildCustomerSummaries();
    const programs   = this.buildProgramSummaries();
    const kpis       = this.buildCampusKpis();
    const exceptions = this.buildExceptions();
    const domainHealth = this.buildDomainHealth();

    return {
      campus: { id: 'jbl-gdl', code: 'JBL-GDL', name: 'Jabil Guadalajara' },
      buildings,
      warehouses,
      customers,
      programs,
      kpis,
      exceptions,
      domainHealth,
      lastUpdated: new Date().toISOString(),
      currentShift: shift,
    };
  }

  // ── Buildings ─────────────────────────────────────────────────────────────────
  // Phase 1: all current backends aggregate into a single "Active Building" entry.
  // New buildings appear here as their lines are added to the backend system.
  private buildBuildingCards(): Building[] {
    const active       = this.backends.filter(b => b.status === 'in_progress');
    const withExc      = this.backends.filter(b => b.exceptions?.length > 0);
    const activeWOs    = this.kits.filter(k => ['in_progress','ready','requested','kitted','prepared'].includes(k.status)).length;
    const shortages    = this.kits.filter(k => (k.totalCompleted ?? 0) < (k.plan?.quantity ?? 0) && k.status === 'in_progress').length;
    const completed    = this.kits.filter(k => k.status === 'completed').length;
    const totalKits    = Math.max(this.kits.length, 1);
    const completionPct = Math.round((completed / totalKits) * 100);

    const risk: RiskLevel = withExc.length > 2 ? 'critical'
      : withExc.length > 0 || shortages > 3 ? 'at_risk' : 'ok';

    // Phase 1: single building derived from current data
    // Phase 2: replaced by real /api/buildings endpoint with N buildings
    return [{
      id: 'bldg-01', campusId: 'jbl-gdl',
      code: 'BLDG-01', name: 'Edificio Principal',
      status: 'active', activeLines: active.length,
      totalLines: Math.max(this.backends.length, 1),
      activeWOs, shortages, completionPct,
      currentShift: this.currentShift(), risk,
    }];
  }

  // ── Warehouses ────────────────────────────────────────────────────────────────
  // Phase 1: modeled warehouse nodes with derived health from kit/material signals.
  // Phase 2: real /api/warehouses endpoint with live utilization and movements.
  private buildWarehouseNodes(): Warehouse[] {
    const pendingKits    = this.kits.filter(k => ['ready','requested'].includes(k.status)).length;
    const inProgressKits = this.kits.filter(k => k.status === 'in_progress').length;

    return [
      {
        id: 'wh-central', campusId: 'jbl-gdl', buildingId: undefined,
        code: 'WH-CENTRAL', name: 'Almacén Central',
        type: 'central', utilizationPct: 62,
        locationCount: 0, activeMovements: pendingKits,
        risk: pendingKits > 20 ? 'at_risk' : 'ok', accuracy: 98.4,
      },
      {
        id: 'wh-local-01', campusId: 'jbl-gdl', buildingId: 'bldg-01',
        code: 'WH-LOCAL-01', name: 'Almacén Edificio 01',
        type: 'building', utilizationPct: 48,
        locationCount: 0, activeMovements: inProgressKits,
        risk: 'ok', accuracy: 97.1,
      },
      {
        id: 'wh-sub-01', campusId: 'jbl-gdl', buildingId: 'bldg-01',
        code: 'WH-SUB-01', name: 'Subalmacén / Línea',
        type: 'subwarehouse', utilizationPct: 74,
        locationCount: 0, activeMovements: inProgressKits,
        risk: inProgressKits > 5 ? 'at_risk' : 'ok',
      },
    ];
  }

  // ── Customers ──────────────────────────────────────────────────────────────────
  // Phase 1: derived from unique plan publication customer fields if available,
  // otherwise a representative placeholder to model the multi-customer reality.
  // Phase 2: real /api/customers endpoint.
  private buildCustomerSummaries(): Customer[] {
    // Extract distinct customers from publications if the field exists
    const fromPubs = [...new Set(
      this.publications.map((p: any) => p.customer).filter(Boolean)
    )].map((name: any, idx: number): Customer => ({
      id: `cust-${idx}`, code: `CUST-${idx}`, name: String(name),
      industry: 'Electronics Manufacturing', activePrograms: 1, risk: 'ok',
    }));

    if (fromPubs.length > 0) return fromPubs;

    // Placeholder: shows the multi-customer structure expected in Phase 2
    return [
      { id: 'cust-ph-01', code: 'CUST-A', name: 'Programa Activo 1', industry: 'Electronics', activePrograms: 2, risk: 'ok' },
      { id: 'cust-ph-02', code: 'CUST-B', name: 'Programa Activo 2', industry: 'Electronics', activePrograms: 1, risk: 'ok' },
    ];
  }

  // ── Programs ───────────────────────────────────────────────────────────────────
  // Phase 1: derived from publication+kit data.
  // Phase 2: real /api/programs endpoint with full program entities.
  private buildProgramSummaries(): ProgramSummary[] {
    const groups = new Map<string, ProgramSummary>();

    this.publications.forEach((pub: any) => {
      const key = pub.customer ?? pub.model ?? 'PROG-GEN';
      if (!groups.has(key)) {
        groups.set(key, {
          id: `prog-${key}`, customerId: 'cust-ph-01',
          customerName: pub.customer ?? 'General',
          code: key, name: pub.title ?? key,
          status: 'active', buildingIds: ['bldg-01'],
          activeWOs: 0, completedWOs: 0, risk: 'ok',
        });
      }
      const pg = groups.get(key)!;
      pg.activeWOs++;
    });

    const excCheck = this.backends.reduce((s: number, b: any) => s + (b.exceptions?.length ?? 0), 0);
    let result = [...groups.values()];
    if (excCheck > 0 && result.length > 0) result[0].risk = 'at_risk';
    return result.slice(0, 8);
  }

  // ── Campus KPIs ────────────────────────────────────────────────────────────────
  private buildCampusKpis(): CampusKpi[] {
    const activeLines   = this.backends.filter(b => b.status === 'in_progress').length;
    const totalLines    = Math.max(this.backends.length, 1);
    const openWOs       = this.kits.filter(k => k.status !== 'completed' && k.status !== 'cancelled').length;
    const completedWOs  = this.kits.filter(k => k.status === 'completed').length;
    const pendingKits   = this.kits.filter(k => ['ready','requested'].includes(k.status)).length;
    const openExc       = this.backends.reduce((s: number, b: any) => s + (b.exceptions?.length ?? 0), 0);
    const pendingCancel = this.cancellations.filter((c: any) => c.status === 'pending').length;
    const activePubs    = this.publications.length;

    return [
      { label: 'Edificios Activos',    value: 1,            sub: 'de 1 configurados', risk: 'ok',       icon: 'fa-building'     },
      { label: 'Líneas en Producción', value: activeLines,  sub: `de ${totalLines} total`, risk: activeLines === 0 ? 'at_risk' : 'ok', icon: 'fa-microchip' },
      { label: 'WOs Abiertos',         value: openWOs,      sub: `${completedWOs} completados`, risk: 'ok', icon: 'fa-file-alt' },
      { label: 'Kits Pendientes',      value: pendingKits,  sub: 'listos para línea', risk: pendingKits > 10 ? 'at_risk' : 'ok', icon: 'fa-boxes-stacked' },
      { label: 'Excepciones Abiertas', value: openExc,      sub: 'en líneas activas', risk: openExc > 3 ? 'critical' : openExc > 0 ? 'at_risk' : 'ok', icon: 'fa-triangle-exclamation' },
      { label: 'Cancelaciones',        value: pendingCancel,sub: 'requieren respuesta', risk: pendingCancel > 0 ? 'critical' : 'ok', icon: 'fa-ban' },
      { label: 'Programas Activos',    value: activePubs,   sub: 'publicaciones en sistema', risk: 'ok', icon: 'fa-calendar-check' },
      { label: 'Almacenes Red',        value: 3,            sub: 'central · local · sublínea', risk: 'ok', icon: 'fa-warehouse' },
    ];
  }

  // ── Exceptions ─────────────────────────────────────────────────────────────────
  private buildExceptions(): EnterpriseException[] {
    const list: EnterpriseException[] = [];

    this.cancellations.filter((c: any) => c.status === 'pending').slice(0, 4).forEach((c: any) => {
      list.push({
        id: `cancel-${c.id}`, severity: 'critical', domain: 'planning',
        buildingId: 'bldg-01',
        message: `Cancelación pendiente: ${c?.publication?.workOrder ?? 'WO'} — ${c?.publication?.model ?? 'N/A'}`,
        time: this.formatTime(c.createdAt), route: '/plan',
      });
    });

    this.backends.filter((b: any) => b.exceptions?.length > 0).slice(0, 5).forEach((b: any) => {
      list.push({
        id: `line-${b.kitId}`, severity: b.exceptions.length > 1 ? 'high' : 'medium',
        domain: 'production', buildingId: 'bldg-01',
        message: `${b.exceptions.length} excepción(es) — ${b.lineCode ?? `BK${b.line}`} · ${b.model ?? 'N/A'}`,
        time: this.formatTime(b.startedAt), route: '/monitor',
      });
    });

    this.kits.filter((k: any) => k.status === 'in_progress' && (k.totalCompleted ?? 0) === 0).slice(0, 3).forEach((k: any) => {
      list.push({
        id: `stall-${k.id}`, severity: 'medium', domain: 'materials', buildingId: 'bldg-01',
        message: `Kit sin avance: ${k.plan?.model ?? 'N/A'} WO ${k.plan?.workOrder ?? k.id}`,
        time: this.formatTime(k.updatedAt ?? k.createdAt), route: '/kits',
      });
    });

    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return list.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3)).slice(0, 8);
  }

  // ── Domain Health Matrix ───────────────────────────────────────────────────────
  private buildDomainHealth(): DomainHealth[] {
    const pendingKits    = this.kits.filter(k => ['ready','requested'].includes(k.status)).length;
    const activeLines    = this.backends.filter(b => b.status === 'in_progress').length;
    const openExc        = this.backends.reduce((s: number, b: any) => s + (b.exceptions?.length ?? 0), 0);
    const pendingCancel  = this.cancellations.filter((c: any) => c.status === 'pending').length;
    const completedKits  = this.kits.filter(k => k.status === 'completed').length;

    return [
      { domain: 'Live Lines',          icon: 'fa-microchip',          route: '/monitor',               status: openExc > 3 ? 'critical' : openExc > 0 ? 'at_risk' : 'ok', metric: `${activeLines} líneas activas`, detail: `${openExc} excepción(es) abiertas` },
      { domain: 'Kitting',             icon: 'fa-boxes-stacked',       route: '/kits',                  status: pendingKits > 15 ? 'at_risk' : 'ok', metric: `${pendingKits} kits pendientes`, detail: `${completedKits} completados` },
      { domain: 'Resupply',            icon: 'fa-truck',               route: '/materials/resupply',    status: 'ok', metric: 'Flujo activo', detail: 'Tablero de resurtido' },
      { domain: 'Planeación',          icon: 'fa-calendar-alt',        route: '/plan',                  status: pendingCancel > 0 ? 'critical' : 'ok', metric: `${this.publications.length} publicaciones`, detail: `${pendingCancel} cancelaciones pendientes` },
      { domain: 'Inventario / IC',     icon: 'fa-barcode',             route: '/materials/cycle-counts', status: 'ok', metric: 'Conteos activos', detail: 'Precisión de inventario' },
      { domain: 'Producción / MES',    icon: 'fa-industry',            route: '/production',            status: 'ok', metric: 'Ejecución activa', detail: 'Ver shopfloor' },
      { domain: 'BOM / Modelos',       icon: 'fa-sitemap',             route: '/bom',                   status: 'ok', metric: 'Estructura de producto', detail: 'Ver modelos y BOMs' },
      { domain: 'Forecast / BI',       icon: 'fa-chart-line',          route: '/forecast',              status: 'ok', metric: 'Análisis activo', detail: 'Decision intelligence' },
      { domain: 'Calidad',             icon: 'fa-certificate',         route: '/monitor',               status: 'ok', metric: 'Coming soon', detail: 'IQC · IPQC · NCR · CAPA' },
      { domain: 'Shipping',            icon: 'fa-truck-fast',          route: '/monitor',               status: 'ok', metric: 'Coming soon', detail: 'Despacho y embarque' },
    ];
  }

  // ── Computed getters ───────────────────────────────────────────────────────────
  get filteredExceptions(): EnterpriseException[] {
    let list = this.campusState?.exceptions ?? [];
    if (this.filterBuilding !== 'all') list = list.filter(e => e.buildingId === this.filterBuilding);
    if (this.filterRisk === 'critical') list = list.filter(e => e.severity === 'critical');
    if (this.filterRisk === 'at_risk')  list = list.filter(e => ['critical','high','medium'].includes(e.severity));
    return list;
  }

  get filteredPrograms(): ProgramSummary[] {
    let list = this.campusState?.programs ?? [];
    if (this.filterCustomer !== 'all') list = list.filter(p => p.customerId === this.filterCustomer);
    if (this.filterRisk !== 'all')     list = list.filter(p => p.risk !== 'ok');
    return list;
  }

  severityClass(s: string): string {
    if (s === 'critical') return 'sev-critical';
    if (s === 'high')     return 'sev-high';
    if (s === 'medium')   return 'sev-med';
    return 'sev-low';
  }

  riskClass(r: RiskLevel): string {
    if (r === 'critical') return 'risk-critical';
    if (r === 'at_risk')  return 'risk-warn';
    if (r === 'blocked')  return 'risk-blocked';
    return 'risk-ok';
  }

  warehouseIcon(type: string): string {
    const icons: Record<string, string> = {
      central: 'fa-warehouse', building: 'fa-building', subwarehouse: 'fa-box',
      pou: 'fa-dolly', quarantine: 'fa-lock', transit: 'fa-truck',
    };
    return icons[type] ?? 'fa-warehouse';
  }

  warehouseTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      central: 'Almacén Central', building: 'Almacén Edificio',
      subwarehouse: 'Subalmacén / Sublínea', pou: 'Punto de Uso',
      quarantine: 'Cuarentena', transit: 'Tránsito',
    };
    return labels[type] ?? type;
  }

  utilizationClass(pct: number): string {
    if (pct >= 90) return 'util-critical';
    if (pct >= 75) return 'util-warn';
    return 'util-ok';
  }

  private currentShift(): Shift {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return 'A';
    if (h >= 14 && h < 22) return 'B';
    return 'C';
  }

  private formatTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(d);
  }
}
