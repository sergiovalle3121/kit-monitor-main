import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EnterpriseContextService } from '../../core/enterprise-context.service';
import { ApiService } from '../../core/api.service';
import { forkJoin, of, catchError } from 'rxjs';

interface KpiCard {
  label: string;
  value: string;
  unit: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  status: 'good' | 'warn' | 'alert';
}

interface LineStatus {
  code: string;
  model: string;
  completed: number;
  target: number;
  oee: number | null;
  status: 'in_progress' | 'ready' | 'completed' | 'scheduled' | 'idle';
}

interface DashboardAlert {
  type: 'critical' | 'warning' | 'info';
  message: string;
  time: string;
  icon: string;
}

interface QuickLink {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly contextService = inject(EnterpriseContextService);
  private readonly api = inject(ApiService);
  
  readonly context = this.contextService.context;
  currentTime = signal(new Date());
  activeKpiIndex = signal(0);
  
  // Real Data Signals
  lines = signal<LineStatus[]>([]);
  alertsList = signal<DashboardAlert[]>([]);
  kpiStats = signal({
    unitsToday: 0,
    oeeAverage: 0,
    activeLines: 0,
    pendingNcrs: 0,
    kitReadiness: 0,
    pendingShipments: 0
  });

  private kpiInterval: any;
  private timeInterval: any;
  private dataInterval: any;

  readonly kpis = computed<KpiCard[]>(() => {
    const s = this.kpiStats();
    return [
      { label: 'Units Produced', value: s.unitsToday.toLocaleString(), unit: 'today', delta: '0%', trend: 'neutral', status: 'good' },
      { label: 'OEE Average',   value: s.oeeAverage.toFixed(1),      unit: '%',     delta: '0%', trend: 'neutral', status: s.oeeAverage > 85 ? 'good' : 'warn' },
      { label: 'Active Lines',   value: s.activeLines.toString(),     unit: 'running',                              status: 'good' },
      { label: 'Open NCRs',      value: s.pendingNcrs.toString(),     unit: 'pending',                              status: s.pendingNcrs > 0 ? 'alert' : 'good' },
      { label: 'Kit Readiness',  value: s.kitReadiness.toString(),    unit: '%',                                     status: 'good' },
      { label: 'Shipments',      value: s.pendingShipments.toString(), unit: 'pending',                             status: 'warn' },
    ];
  });

  readonly quickLinks: QuickLink[] = [
    { label: 'Control Tower',  route: '/control-tower',     icon: 'fa-globe'                  },
    { label: 'Live Monitor',   route: '/monitor',           icon: 'fa-desktop'                },
    { label: 'Planning',       route: '/plan',              icon: 'fa-calendar-alt'           },
    { label: 'Quality',        route: '/quality-center',    icon: 'fa-certificate'            },
    { label: 'Materials',      route: '/materials/inventory', icon: 'fa-warehouse'            },
    { label: 'Exceptions',     route: '/exception-center',  icon: 'fa-triangle-exclamation'   },
  ];

  ngOnInit(): void {
    this.refreshData();
    
    this.kpiInterval = setInterval(() => {
      this.activeKpiIndex.update(v => (v + 1) % 6);
    }, 4000);

    this.timeInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 60_000);

    this.dataInterval = setInterval(() => this.refreshData(), 30_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.kpiInterval);
    clearInterval(this.timeInterval);
    clearInterval(this.dataInterval);
  }

  refreshData() {
    forkJoin({
      lines: this.api.getProductionBackends().pipe(catchError(() => of([]))),
      ncrs: this.api.getAllNcrs({ status: 'OPEN' }).pipe(catchError(() => of([]))),
      notifications: this.api.getNotifications().pipe(catchError(() => of([]))),
      kits: this.api.getKits().pipe(catchError(() => of([]))),
      shipments: this.api.getShipments().pipe(catchError(() => of([])))
    }).subscribe(data => {
      const mappedLines: LineStatus[] = data.lines.map((l: any) => ({
        code: l.lineCode || `BK${l.line}`,
        model: l.model || '—',
        completed: l.completedCount || 0,
        target: l.targetCount || 0,
        oee: l.oee || null,
        status: l.status || 'idle'
      }));
      this.lines.set(mappedLines);

      const mappedAlerts: DashboardAlert[] = data.notifications.slice(0, 5).map((n: any) => ({
        type: n.type === 'critical' ? 'critical' : n.type === 'warning' ? 'warning' : 'info',
        message: n.message,
        time: this.formatTimeAgo(n.createdAt),
        icon: this.getAlertIcon(n.type)
      }));
      this.alertsList.set(mappedAlerts);

      const activeLines = mappedLines.filter(l => l.status === 'in_progress').length;
      const oeeValues = mappedLines.filter(l => l.oee !== null).map(l => l.oee as number);
      const oeeAvg = oeeValues.length > 0 ? oeeValues.reduce((a, b) => a + b, 0) / oeeValues.length : 0;
      
      this.kpiStats.set({
        unitsToday: mappedLines.reduce((acc, l) => acc + l.completed, 0),
        oeeAverage: oeeAvg,
        activeLines: activeLines,
        pendingNcrs: data.ncrs.length,
        kitReadiness: this.calculateKitReadiness(data.kits),
        pendingShipments: data.shipments.filter((s: any) => s.status !== 'DELIVERED').length
      });
    });
  }

  private calculateKitReadiness(kits: any[]): number {
    if (!kits.length) return 0;
    const ready = kits.filter(k => k.status === 'ready').length;
    return Math.round((ready / kits.length) * 100);
  }

  private formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  private getAlertIcon(type: string): string {
    if (type === 'critical') return 'fa-triangle-exclamation';
    if (type === 'warning') return 'fa-circle-exclamation';
    return 'fa-info-circle';
  }

  get greeting(): string {
    const h = this.currentTime().getHours();
    const building = this.contextService.buildings().find((b: any) => b.id === this.context().buildingId);
    const suffix = building ? ` en ${building.code}` : '';
    
    if (h < 12) return `Buenos días${suffix}`;
    if (h < 18) return `Buenas tardes${suffix}`;
    return `Buenas noches${suffix}`;
  }

  get formattedDate(): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).format(this.currentTime());
  }

  get formattedTime(): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(this.currentTime());
  }

  lineProgress(line: LineStatus): number {
    if (!line.target) return 0;
    return Math.min(100, Math.round((line.completed / line.target) * 100));
  }

  lineStatusLabel(status: LineStatus['status']): string {
    const labels: Record<LineStatus['status'], string> = {
      in_progress: 'In Progress',
      ready:       'Ready',
      completed:   'Completed',
      scheduled:   'Scheduled',
      idle:        'Idle',
    };
    return labels[status];
  }
}
