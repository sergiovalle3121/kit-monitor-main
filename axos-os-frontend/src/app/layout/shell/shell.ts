import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { filter, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { EnterpriseContextService } from '../../core/enterprise-context.service';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

type ModuleState = 'active' | 'partial' | 'planned';

interface NavItemConfig {
  label: string;
  route: string;
  icon: string;
  state: ModuleState;
  note?: string;
}

interface NavGroupConfig {
  id: string;
  label: string;
  short: string;
  icon: string;
  items: NavItemConfig[];
}

interface SearchResult {
  label: string;
  route: string;
  category: 'modulos' | 'kits_modelos' | 'np' | 'publicaciones';
  subtitle?: string;
}

interface ShellNotification {
  id: string;
  message: string;
  type: 'publication' | 'kit_ready' | 'partial' | 'ops' | 'cancellation';
  createdAt: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, ConfirmModalComponent],
  templateUrl: './shell.html',
  styleUrls: ['./shell.css'],
})
export class ShellComponent implements OnInit, OnDestroy {
  collapsed = false;
  openSection: string | null = null;
  searchTerm = '';
  showSearchResults = false;
  searchResults: SearchResult[] = [];
  showUserPanel = false;
  showNotifications = false;
  showContextPanel = false;
  notifications: ShellNotification[] = [];
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('searchWrapper') searchWrapper?: ElementRef<HTMLElement>;
  @ViewChild('notificationsWrap') notificationsWrap?: ElementRef<HTMLElement>;
  @ViewChild('userWrap') userWrap?: ElementRef<HTMLElement>;
  @ViewChild('contextWrap') contextWrap?: ElementRef<HTMLElement>;
  private notificationsTimerId: number | null = null;

  readonly navGroups: NavGroupConfig[] = [
    {
      id: 'executive',
      label: 'Executive / Command',
      short: 'EX',
      icon: 'fa-tower-broadcast',
      items: [
        { label: 'Control Tower', route: '/control-tower', icon: 'fa-globe', state: 'active' },
        { label: 'Site Overview', route: '/roadmap/executive/site-overview', icon: 'fa-building', state: 'planned', note: 'Enterprise roadmap' },
        { label: 'Risk Center', route: '/roadmap/executive/risk-center', icon: 'fa-triangle-exclamation', state: 'planned', note: 'Enterprise roadmap' },
        { label: 'Analytics', route: '/roadmap/executive/analytics', icon: 'fa-chart-line', state: 'partial', note: 'Using Forecast + KPIs' },
        { label: 'Cost & Risk', route: '/roadmap/executive/cost-risk', icon: 'fa-sack-dollar', state: 'planned', note: 'Enterprise roadmap' },
      ],
    },
    {
      id: 'supply',
      label: 'Supply Chain / Materials',
      short: 'SC',
      icon: 'fa-box-open',
      items: [
        { label: 'Receiving / Inbound', route: '/roadmap/materials/receiving', icon: 'fa-dolly', state: 'planned', note: 'Foundation pending' },
        { label: 'Central Warehouse', route: '/roadmap/materials/central-warehouse', icon: 'fa-warehouse', state: 'planned', note: 'Foundation pending' },
        { label: 'Building Warehouses', route: '/roadmap/materials/building-warehouses', icon: 'fa-warehouse', state: 'planned', note: 'Foundation pending' },
        { label: 'Inventory Control', route: '/roadmap/materials/inventory-control', icon: 'fa-barcode', state: 'planned', note: 'Foundation pending' },
        { label: 'Kitting', route: '/kits', icon: 'fa-boxes', state: 'active' },
        { label: 'Resupply / Pull Monitor', route: '/materials/resupply', icon: 'fa-truck-loading', state: 'active' },
        { label: 'Cycle Counts', route: '/materials/cycle-counts', icon: 'fa-clipboard-list', state: 'active' },
        { label: 'Material Traceability', route: '/roadmap/materials/traceability', icon: 'fa-fingerprint', state: 'planned', note: 'Roadmap' },
        { label: 'Holds / Quarantine', route: '/roadmap/materials/quarantine', icon: 'fa-shield-halved', state: 'planned', note: 'Roadmap' },
      ],
    },
    {
      id: 'planning',
      label: 'Planning / Program',
      short: 'PL',
      icon: 'fa-calendar-alt',
      items: [
        { label: 'Planning', route: '/plan', icon: 'fa-bullhorn', state: 'active' },
        { label: 'Scheduling / Capacity', route: '/roadmap/planning/capacity', icon: 'fa-chart-gantt', state: 'planned', note: 'Roadmap' },
        { label: 'Forecast / Demand', route: '/forecast', icon: 'fa-brain', state: 'active' },
        { label: 'Program Control', route: '/roadmap/planning/program-control', icon: 'fa-briefcase', state: 'partial', note: 'Enterprise topology in progress' },
        { label: 'Customer / Program View', route: '/control-tower', icon: 'fa-users', state: 'partial', note: 'Control Tower filters' },
      ],
    },
    {
      id: 'engineering',
      label: 'Engineering',
      short: 'EN',
      icon: 'fa-chalkboard-user',
      items: [
        { label: 'Industrial Engineering', route: '/roadmap/engineering/ie', icon: 'fa-compass-drafting', state: 'partial', note: 'BOM/Layout foundations active' },
        { label: 'Product Engineering', route: '/roadmap/engineering/product-engineering', icon: 'fa-microchip', state: 'planned', note: 'Roadmap' },
        { label: 'BOM / Model Structure', route: '/bom', icon: 'fa-cubes', state: 'active' },
        { label: 'Routing', route: '/roadmap/engineering/routing', icon: 'fa-route', state: 'planned', note: 'Roadmap' },
        { label: 'NPI / ECO / Change Control', route: '/roadmap/engineering/npi-eco', icon: 'fa-code-branch', state: 'planned', note: 'Roadmap' },
        { label: 'Visual Aids / SOPs', route: '/visual-aids', icon: 'fa-eye', state: 'active' },
        { label: 'Disposition / Line Layout', route: '/disposition', icon: 'fa-vector-square', state: 'active' },
      ],
    },
    {
      id: 'execution',
      label: 'Execution / MES',
      short: 'MES',
      icon: 'fa-industry',
      items: [
        { label: 'Production', route: '/production', icon: 'fa-tools', state: 'active' },
        { label: 'Hour-by-Hour', route: '/production/hourly', icon: 'fa-clock', state: 'active' },
        { label: 'Live Line Monitor', route: '/monitor', icon: 'fa-desktop', state: 'active' },
        { label: 'WIP / Runtime', route: '/control-tower', icon: 'fa-gauge-high', state: 'partial', note: 'Topology-backed runtime' },
        { label: 'Completed Runs', route: '/production/completed', icon: 'fa-check-circle', state: 'active' },
        { label: 'Incidents / Andon', route: '/roadmap/execution/incidents-andon', icon: 'fa-bell', state: 'partial', note: 'Incidents foundation in runtime API' },
      ],
    },
    {
      id: 'quality',
      label: 'Quality',
      short: 'QA',
      icon: 'fa-certificate',
      items: [
        { label: 'IQC', route: '/roadmap/quality/iqc', icon: 'fa-clipboard-check', state: 'planned' },
        { label: 'IPQC', route: '/roadmap/quality/ipqc', icon: 'fa-vial', state: 'planned' },
        { label: 'OQC', route: '/roadmap/quality/oqc', icon: 'fa-box-check', state: 'planned' },
        { label: 'NCR', route: '/roadmap/quality/ncr', icon: 'fa-triangle-exclamation', state: 'planned' },
        { label: 'CAPA', route: '/roadmap/quality/capa', icon: 'fa-screwdriver-wrench', state: 'planned' },
        { label: 'Holds / Release', route: '/roadmap/quality/holds-release', icon: 'fa-lock', state: 'planned' },
        { label: 'Supplier Quality', route: '/roadmap/quality/supplier-quality', icon: 'fa-handshake', state: 'planned' },
      ],
    },
    {
      id: 'logistics',
      label: 'Logistics / Shipping',
      short: 'LG',
      icon: 'fa-truck-fast',
      items: [
        { label: 'Finished Goods', route: '/roadmap/logistics/finished-goods', icon: 'fa-box-archive', state: 'planned' },
        { label: 'Packing', route: '/roadmap/logistics/packing', icon: 'fa-box-tape', state: 'planned' },
        { label: 'Dispatch', route: '/roadmap/logistics/dispatch', icon: 'fa-truck-ramp-box', state: 'planned' },
        { label: 'Shipment Status', route: '/roadmap/logistics/shipment-status', icon: 'fa-location-arrow', state: 'planned' },
      ],
    },
    {
      id: 'support',
      label: 'Plant Support',
      short: 'PS',
      icon: 'fa-screwdriver-wrench',
      items: [
        { label: 'Maintenance', route: '/roadmap/support/maintenance', icon: 'fa-wrench', state: 'planned' },
        { label: 'Facilities / Utilities', route: '/roadmap/support/facilities', icon: 'fa-bolt', state: 'planned' },
        { label: 'EHS / Safety', route: '/roadmap/support/ehs', icon: 'fa-helmet-safety', state: 'planned' },
        { label: 'Training / Certification', route: '/roadmap/support/training', icon: 'fa-user-graduate', state: 'planned' },
        { label: 'Document Control', route: '/roadmap/support/document-control', icon: 'fa-file-lines', state: 'planned' },
      ],
    },
    {
      id: 'platform',
      label: 'Platform / Governance',
      short: 'PF',
      icon: 'fa-cogs',
      items: [
        { label: 'Administration', route: '/roadmap/platform/administration', icon: 'fa-sliders', state: 'planned' },
        { label: 'Users / Roles', route: '/roadmap/platform/users-roles', icon: 'fa-users-gear', state: 'planned' },
        { label: 'Master Data', route: '/roadmap/platform/master-data', icon: 'fa-database', state: 'partial', note: 'Enterprise dimensions active' },
        { label: 'Audit / Ledger', route: '/roadmap/platform/audit-ledger', icon: 'fa-scroll', state: 'partial', note: 'Ledger module active' },
        { label: 'Configuration', route: '/roadmap/platform/configuration', icon: 'fa-gears', state: 'planned' },
      ],
    },
  ];

  private readonly modulesCatalog: SearchResult[] = this.navGroups
    .flatMap((group) => group.items.map((item) => ({
      label: `${item.label} (${group.label})`,
      route: item.route,
      category: 'modulos' as const,
      subtitle: this.stateLabel(item.state),
    })));

  constructor(
    private auth: AuthService,
    private router: Router,
    private readonly api: ApiService,
    readonly enterpriseContext: EnterpriseContextService,
  ) {
    this.syncSection(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncSection(event.urlAfterRedirects);
        this.showSearchResults = false;
        this.showUserPanel = false;
      });
  }

  ngOnInit(): void {
    this.enterpriseContext.preload();
    this.refreshNotifications();
    this.notificationsTimerId = window.setInterval(() => this.refreshNotifications(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.notificationsTimerId !== null) window.clearInterval(this.notificationsTimerId);
  }

  toggle(): void { this.collapsed = !this.collapsed; }

  toggleSection(section: string): void { this.openSection = this.openSection === section ? null : section; }

  logout(): void { this.auth.logout(); }

  onSearchFocus(): void {
    this.showSearchResults = true;
    this.computeSearchResults();
    setTimeout(() => this.searchInput?.nativeElement.focus());
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.computeSearchResults();
    this.showSearchResults = true;
  }

  openSearchResult(result: SearchResult): void {
    this.router.navigateByUrl(result.route);
    this.searchTerm = '';
    this.showSearchResults = false;
  }

  toggleUserPanel(): void {
    this.showUserPanel = !this.showUserPanel;
    this.showNotifications = false;
  }

  toggleNotifications(): void {
    if (!this.showNotifications) this.refreshNotifications();
    this.showNotifications = !this.showNotifications;
    this.showUserPanel = false;
  }


  toggleContextPanel(): void {
    this.showContextPanel = !this.showContextPanel;
  }

  clearContextToken(key: string, event: MouseEvent): void {
    event.stopPropagation();
    this.enterpriseContext.update({ [key]: undefined });
  }

  get hasActiveContext(): boolean {
    const ctx = this.enterpriseContext.context();
    return !!(ctx.buildingId || ctx.programId || ctx.lineId);
  }

  get activeContextTokens(): Array<{ label: string; key: string }> {
    const ctx = this.enterpriseContext.context();
    const tokens: Array<{ label: string; key: string }> = [];
    if (ctx.buildingId) {
      const b = this.enterpriseContext.buildings().find((x) => x.id === ctx.buildingId);
      tokens.push({ label: b ? b.code : ctx.buildingId, key: 'buildingId' });
    }
    if (ctx.programId) {
      const p = this.enterpriseContext.programs().find((x) => x.id === ctx.programId);
      tokens.push({ label: p ? p.code : ctx.programId, key: 'programId' });
    }
    if (ctx.lineId) {
      const l = this.enterpriseContext.lines().find((x) => x.id === ctx.lineId);
      tokens.push({ label: l ? l.code : ctx.lineId, key: 'lineId' });
    }
    return tokens;
  }

  onContextChange(field: string, value: string): void {
    this.enterpriseContext.update({ [field]: value || undefined });
  }

  clearEnterpriseContext(): void {
    this.enterpriseContext.clear();
    this.showContextPanel = false;
  }

  stateLabel(state: ModuleState): string {
    if (state === 'active') return 'Activo';
    if (state === 'partial') return 'Parcial';
    return 'Planificado';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (this.searchWrapper?.nativeElement && !this.searchWrapper.nativeElement.contains(target)) this.showSearchResults = false;
    if (this.notificationsWrap?.nativeElement && !this.notificationsWrap.nativeElement.contains(target)) this.showNotifications = false;
    if (this.userWrap?.nativeElement && !this.userWrap.nativeElement.contains(target)) this.showUserPanel = false;
    if (this.contextWrap?.nativeElement && !this.contextWrap.nativeElement.contains(target)) this.showContextPanel = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showSearchResults = false;
    this.showNotifications = false;
    this.showUserPanel = false;
    this.showContextPanel = false;
  }

  clearNotifications(): void {
    this.notifications = [];
    localStorage.removeItem('km_shell_notifications');
  }

  private computeSearchResults(): void {
    const term = this.searchTerm.trim().toUpperCase();
    if (!term) {
      this.searchResults = this.modulesCatalog.slice(0, 8);
      return;
    }

    const localMatches = this.modulesCatalog.filter((entry) => entry.label.toUpperCase().includes(term));
    const dynamicMatches = this.buildDynamicSearch(term);
    this.searchResults = [...localMatches, ...dynamicMatches].slice(0, 12);
  }

  private buildDynamicSearch(term: string): SearchResult[] {
    const results: SearchResult[] = [];
    this.notifications.filter((item) => item.message.toUpperCase().includes(term)).slice(0, 3).forEach((item) => {
      results.push({
        label: item.message,
        route: item.type === 'publication' ? '/plan' : '/production',
        category: 'publicaciones',
        subtitle: this.formatTimestamp(item.createdAt),
      });
    });
    return results;
  }

  private refreshNotifications(): void {
    forkJoin({
      publications: this.api.getPlanPublications(),
      kits: this.api.getKits(),
      backends: this.api.getProductionBackends(),
      cancellations: this.api.getRecentCancellationRequests(),
    }).subscribe({
      next: ({ publications, kits, backends, cancellations }) => {
        const now = Date.now();
        const fromPublications = (publications ?? []).slice(0, 8).map((item: any) => ({
          id: `pub-${item.id}`,
          message: `Plan publicado #${item.id} (${item.title ?? 'sin título'})`,
          type: 'publication' as const,
          createdAt: item.createdAt ?? new Date().toISOString(),
        }));

        const fromReadyKits = (kits ?? []).filter((kit: any) => ['ready', 'requested'].includes(kit.status)).slice(0, 8).map((kit: any) => ({
          id: `kit-ready-${kit.id}`,
          message: `Kit listo para línea: ${kit.plan?.model ?? 'N/A'} BK${kit.plan?.line ?? '-'}`,
          type: 'kit_ready' as const,
          createdAt: kit.updatedAt ?? kit.createdAt ?? new Date().toISOString(),
        }));

        const fromPartial = (kits ?? []).filter((kit: any) => (kit.totalCompleted ?? 0) > 0 && (kit.totalCompleted ?? 0) < (kit.plan?.quantity ?? Number.MAX_SAFE_INTEGER)).slice(0, 8).map((kit: any) => ({
          id: `kit-partial-${kit.id}`,
          message: `Ensamble parcial ${kit.plan?.model ?? 'N/A'}: ${kit.totalCompleted}/${kit.plan?.quantity ?? 0}`,
          type: 'partial' as const,
          createdAt: kit.updatedAt ?? kit.createdAt ?? new Date().toISOString(),
        }));

        const fromOps = (backends ?? []).filter((backend: any) => backend.status === 'in_progress').slice(0, 6).map((backend: any) => ({
          id: `ops-${backend.kitId}`,
          message: `Operación activa ${backend.lineCode ?? `BK${backend.line}`}: ${backend.model ?? 'N/A'}`,
          type: 'ops' as const,
          createdAt: backend.startedAt ?? new Date().toISOString(),
        }));

        const fromCancellations = (cancellations ?? []).slice(0, 20).map((request: any) => {
          const wo = request?.publication?.workOrder ?? 'WO';
          const model = request?.publication?.model ?? 'N/A';
          if (request.status === 'pending') return { id: `cancel-${request.id}`, message: `⚠️ Planeación solicita cancelar el kit ${wo} de ${model}. Tienes 30 minutos para responder.`, type: 'cancellation' as const, createdAt: request.createdAt ?? new Date().toISOString() };
          if (request.status === 'accepted') return { id: `cancel-${request.id}`, message: `El kitteador autorizó la cancelación de ${wo}. Ya puedes eliminar la publicación.`, type: 'cancellation' as const, createdAt: request.respondedAt ?? request.createdAt ?? new Date().toISOString() };
          if (request.status === 'rejected') return { id: `cancel-${request.id}`, message: `El kitteador rechazó la cancelación del kit ${wo}. La publicación se conserva.`, type: 'cancellation' as const, createdAt: request.respondedAt ?? request.createdAt ?? new Date().toISOString() };
          return { id: `cancel-${request.id}`, message: `Sin respuesta del kitteador. Cancelación de ${wo} rechazada por timeout.`, type: 'cancellation' as const, createdAt: request.respondedAt ?? request.expiresAt ?? request.createdAt ?? new Date().toISOString() };
        });

        const merged = [...fromPublications, ...fromReadyKits, ...fromPartial, ...fromOps, ...fromCancellations]
          .filter((item) => now - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        this.notifications = merged;
        localStorage.setItem('km_shell_notifications', JSON.stringify(merged));
      },
      error: () => {
        const cached = localStorage.getItem('km_shell_notifications');
        this.notifications = cached ? JSON.parse(cached) : [];
      },
    });
  }

  notificationTypeLabel(type: ShellNotification['type']): string {
    if (type === 'publication') return 'Publicación';
    if (type === 'kit_ready') return 'Kit listo';
    if (type === 'partial') return 'Parcial';
    if (type === 'cancellation') return 'Cancelación';
    return 'Operación';
  }

  formatTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'sin fecha';
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  private syncSection(url: string): void {
    const group = this.navGroups.find((entry) => entry.items.some((item) => url === item.route || url.startsWith(`${item.route}/`)));
    this.openSection = group?.id ?? null;
  }
}
