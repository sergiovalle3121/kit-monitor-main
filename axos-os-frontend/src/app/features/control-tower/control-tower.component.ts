import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { forkJoin, interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

/** Risk classification returned by the enterprise overview */
type RiskLevel = 'ok' | 'at_risk' | 'critical' | 'blocked';

interface SiteCard {
  id: string;
  code: string;
  name: string;
  risk: RiskLevel;
  activeLines: number;
  totalLines: number;
  activeWOs: number;
  shortages: number;
  completionPct: number;
  shift: string;
}

interface EnterpriseKpi {
  label: string;
  value: string | number;
  sub?: string;
  risk?: RiskLevel;
  icon: string;
}

interface ExceptionItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  domain: string;
  message: string;
  time: string;
  route: string;
}

interface DomainHealth {
  domain: string;
  icon: string;
  route: string;
  status: RiskLevel;
  metric: string;
  detail: string;
}

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

  // Filters (enterprise dimensions — Phase 1 UI, Phase 2 backend)
  filterSite = 'all';
  filterProgram = 'all';
  filterRisk = 'all';

  // Live timestamp
  lastUpdated = '';
  private refreshSub?: Subscription;

  // Derived state from real APIs
  sites: SiteCard[] = [];
  kpis: EnterpriseKpi[] = [];
  exceptions: ExceptionItem[] = [];
  domainHealth: DomainHealth[] = [];

  // Raw API data
  private backends: any[] = [];
  private kits: any[] = [];
  private publications: any[] = [];
  private cancellations: any[] = [];

  readonly riskColors: Record<RiskLevel, string> = {
    ok: 'risk-ok',
    at_risk: 'risk-warn',
    critical: 'risk-critical',
    blocked: 'risk-blocked',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    // Refresh every 30s with real API data
    this.refreshSub = interval(30_000)
      .pipe(startWith(0), switchMap(() => this.fetchAll()))
      .subscribe({
        next: (data) => {
          this.backends = data.backends ?? [];
          this.kits = data.kits ?? [];
          this.publications = data.publications ?? [];
          this.cancellations = data.cancellations ?? [];
          this.buildState();
          this.lastUpdated = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          this.loading = false;
        },
        error: () => {
          this.error = 'No se pudo conectar con el servidor. Reintentando…';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private fetchAll() {
    return forkJoin({
      backends: this.api.getProductionBackends(),
      kits: this.api.getKits(),
      publications: this.api.getPlanPublications(),
      cancellations: this.api.getRecentCancellationRequests(),
    });
  }

  /** Build enterprise state from raw API data */
  private buildState(): void {
    this.buildSites();
    this.buildKpis();
    this.buildExceptions();
    this.buildDomainHealth();
  }

  /** Phase 1: Single site built from current backend data.
   *  Phase 2+: Multiple sites from a real /sites endpoint. */
  private buildSites(): void {
    const active = this.backends.filter(b => b.status === 'in_progress');
    const withException = this.backends.filter(b => b.exceptions?.length > 0);
    const totalLines = this.backends.length;
    const activeWOs = this.kits.filter(k => ['in_progress', 'ready', 'requested', 'kitted', 'prepared'].includes(k.status)).length;
    const shortages = this.kits.filter(k => (k.totalCompleted ?? 0) < (k.plan?.quantity ?? 0) && k.status === 'in_progress').length;
    const completed = this.kits.filter(k => k.status === 'completed').length;
    const totalKits = this.kits.length || 1;
    const completionPct = Math.round((completed / totalKits) * 100);

    const risk: RiskLevel = withException.length > 2 ? 'critical'
      : withException.length > 0 ? 'at_risk'
      : shortages > 3 ? 'at_risk'
      : 'ok';

    this.sites = [{
      id: 'site-001',
      code: 'SITE-01',
      name: 'Planta Principal',
      risk,
      activeLines: active.length,
      totalLines,
      activeWOs,
      shortages,
      completionPct,
      shift: this.currentShift(),
    }];
  }

  private buildKpis(): void {
    const activeLines = this.backends.filter(b => b.status === 'in_progress').length;
    const totalWOs = this.kits.length;
    const completedWOs = this.kits.filter(k => k.status === 'completed').length;
    const openExceptions = this.backends.reduce((sum: number, b: any) => sum + (b.exceptions?.length ?? 0), 0);
    const pendingKits = this.kits.filter(k => ['ready', 'requested'].includes(k.status)).length;
    const pendingCancellations = this.cancellations.filter((c: any) => c.status === 'pending').length;

    this.kpis = [
      { label: 'Líneas Activas', value: activeLines, sub: `de ${this.backends.length} configuradas`, risk: activeLines === 0 ? 'at_risk' : 'ok', icon: '⚙️' },
      { label: 'Work Orders Abiertos', value: totalWOs - completedWOs, sub: `${completedWOs} completados hoy`, risk: 'ok', icon: '📄' },
      { label: 'Kits Pendientes', value: pendingKits, sub: 'listos para línea', risk: pendingKits > 10 ? 'at_risk' : 'ok', icon: '📦' },
      { label: 'Excepciones Abiertas', value: openExceptions, sub: 'en líneas activas', risk: openExceptions > 3 ? 'critical' : openExceptions > 0 ? 'at_risk' : 'ok', icon: '🚨' },
      { label: 'Cancelaciones Pendientes', value: pendingCancellations, sub: 'requieren respuesta', risk: pendingCancellations > 0 ? 'critical' : 'ok', icon: '⚠️' },
      { label: 'Publicaciones Activas', value: this.publications.length, sub: 'planes en sistema', risk: 'ok', icon: '📋' },
    ];
  }

  private buildExceptions(): void {
    this.exceptions = [];

    // Cancellations — highest priority
    this.cancellations
      .filter((c: any) => c.status === 'pending')
      .slice(0, 4)
      .forEach((c: any) => {
        const wo = c?.publication?.workOrder ?? 'WO';
        const model = c?.publication?.model ?? 'N/A';
        this.exceptions.push({
          id: `cancel-${c.id}`,
          severity: 'critical',
          domain: 'Planning',
          message: `Cancelación pendiente de ${wo} — ${model}`,
          time: this.formatTime(c.createdAt),
          route: '/plan',
        });
      });

    // Line exceptions
    this.backends
      .filter((b: any) => b.exceptions?.length > 0)
      .slice(0, 5)
      .forEach((b: any) => {
        const line = b.lineCode ?? `BK${b.line}`;
        this.exceptions.push({
          id: `line-exc-${b.kitId}`,
          severity: b.exceptions.length > 1 ? 'high' : 'medium',
          domain: 'Producción',
          message: `${b.exceptions.length} excepción(es) en ${line} — ${b.model ?? 'N/A'}`,
          time: this.formatTime(b.startedAt),
          route: '/monitor',
        });
      });

    // WOs with no progress
    this.kits
      .filter((k: any) => k.status === 'in_progress' && (k.totalCompleted ?? 0) === 0)
      .slice(0, 3)
      .forEach((k: any) => {
        this.exceptions.push({
          id: `stall-${k.id}`,
          severity: 'medium',
          domain: 'Kitting',
          message: `Kit sin avance: ${k.plan?.model ?? 'N/A'} WO ${k.plan?.workOrder ?? k.id}`,
          time: this.formatTime(k.updatedAt ?? k.createdAt),
          route: '/kits',
        });
      });

    // Sort by severity
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    this.exceptions.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    this.exceptions = this.exceptions.slice(0, 8);
  }

  private buildDomainHealth(): void {
    const pendingKits = this.kits.filter(k => ['ready', 'requested'].includes(k.status)).length;
    const activeLines = this.backends.filter(b => b.status === 'in_progress').length;
    const openExceptions = this.backends.reduce((s: number, b: any) => s + (b.exceptions?.length ?? 0), 0);
    const pendingCancellations = this.cancellations.filter((c: any) => c.status === 'pending').length;

    this.domainHealth = [
      {
        domain: 'Control Tower',
        icon: '🗼',
        route: '/monitor',
        status: openExceptions > 3 ? 'critical' : openExceptions > 0 ? 'at_risk' : 'ok',
        metric: `${activeLines} líneas activas`,
        detail: `${openExceptions} excepción(es)`,
      },
      {
        domain: 'Kitting',
        icon: '📦',
        route: '/kits',
        status: pendingKits > 15 ? 'at_risk' : 'ok',
        metric: `${pendingKits} kits pendientes`,
        detail: `${this.kits.filter(k => k.status === 'completed').length} completados`,
      },
      {
        domain: 'Resupply',
        icon: '🚚',
        route: '/materials/resupply',
        status: 'ok',
        metric: 'Flujo activo',
        detail: 'Ver tablero de resurtido',
      },
      {
        domain: 'Planeación',
        icon: '📋',
        route: '/plan',
        status: pendingCancellations > 0 ? 'critical' : 'ok',
        metric: `${this.publications.length} publicaciones`,
        detail: `${pendingCancellations} cancel. pendientes`,
      },
      {
        domain: 'Producción',
        icon: '⚙️',
        route: '/production',
        status: 'ok',
        metric: 'Ejecución activa',
        detail: 'Ver detalle de línea',
      },
      {
        domain: 'Inventario',
        icon: '🗃️',
        route: '/materials/cycle-counts',
        status: 'ok',
        metric: 'Conteos activos',
        detail: 'Ver precisión de inventario',
      },
    ];
  }

  get filteredExceptions(): ExceptionItem[] {
    if (this.filterRisk === 'all') return this.exceptions;
    const map: Record<string, string[]> = {
      critical: ['critical'],
      at_risk: ['critical', 'high', 'medium'],
    };
    const allowed = map[this.filterRisk] ?? [];
    return this.exceptions.filter(e => allowed.includes(e.severity));
  }

  severityClass(s: string): string {
    if (s === 'critical') return 'sev-critical';
    if (s === 'high') return 'sev-high';
    if (s === 'medium') return 'sev-med';
    return 'sev-low';
  }

  private currentShift(): string {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return 'Turno A';
    if (h >= 14 && h < 22) return 'Turno B';
    return 'Turno C';
  }

  private formatTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(d);
  }
}
