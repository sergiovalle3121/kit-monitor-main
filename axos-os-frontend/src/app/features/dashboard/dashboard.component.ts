import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

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

interface Alert {
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

import { EnterpriseContextService } from '../../core/enterprise-context.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly contextService = inject(EnterpriseContextService);
  readonly context = this.contextService.context;
  currentTime = new Date();
  activeKpiIndex = 0;
  private kpiInterval: number | null = null;
  private timeInterval: number | null = null;

  readonly kpis: KpiCard[] = [
    { label: 'Units Produced', value: '1,847', unit: 'today',     delta: '+12%', trend: 'up',   status: 'good' },
    { label: 'OEE',            value: '91.4',  unit: '%',         delta: '-1.2%', trend: 'down', status: 'warn' },
    { label: 'Active Lines',   value: '4',     unit: 'of 6',                                    status: 'good' },
    { label: 'Open NCRs',      value: '7',     unit: 'pending',   delta: '+2',   trend: 'down', status: 'alert' },
    { label: 'Kit Readiness',  value: '86',    unit: '%',         delta: '+4%',  trend: 'up',   status: 'good' },
    { label: 'Shipments',      value: '12',    unit: 'pending',                                 status: 'warn' },
  ];

  readonly lines: LineStatus[] = [
    { code: 'BK1', model: 'XA-220', completed: 234, target: 300, oee: 94.2, status: 'in_progress' },
    { code: 'BK2', model: 'XB-110', completed: 0,   target: 150, oee: null, status: 'ready'       },
    { code: 'BK3', model: 'XA-220', completed: 300, target: 300, oee: 97.1, status: 'completed'   },
    { code: 'BK4', model: 'XC-440', completed: 0,   target: 200, oee: null, status: 'scheduled'   },
    { code: 'BK5', model: 'XB-110', completed: 89,  target: 150, oee: 88.5, status: 'in_progress' },
    { code: 'BK6', model: '—',      completed: 0,   target: 0,   oee: null, status: 'idle'        },
  ];

  readonly alerts: Alert[] = [
    { type: 'critical', message: 'BK5 OEE below 90% threshold',      time: '14 min ago', icon: 'fa-triangle-exclamation' },
    { type: 'warning',  message: 'Kit shortage for BK4 · XC-440',    time: '32 min ago', icon: 'fa-box-open'             },
    { type: 'warning',  message: 'NCR #1042 requires disposition',    time: '1 hr ago',   icon: 'fa-clipboard-check'      },
    { type: 'info',     message: 'Plan published for tomorrow',       time: '2 hr ago',   icon: 'fa-calendar-check'       },
  ];

  readonly quickLinks: QuickLink[] = [
    { label: 'Control Tower',  route: '/control-tower',     icon: 'fa-globe'                  },
    { label: 'Live Monitor',   route: '/monitor',           icon: 'fa-desktop'                },
    { label: 'Planning',       route: '/plan',              icon: 'fa-calendar-alt'           },
    { label: 'Quality',        route: '/quality-center',    icon: 'fa-certificate'            },
    { label: 'Materials',      route: '/materials/inventory', icon: 'fa-warehouse'            },
    { label: 'Exceptions',     route: '/exception-center',  icon: 'fa-triangle-exclamation'   },
  ];

  ngOnInit(): void {
    this.kpiInterval = window.setInterval(() => {
      this.activeKpiIndex = (this.activeKpiIndex + 1) % this.kpis.length;
    }, 3200);
    this.timeInterval = window.setInterval(() => {
      this.currentTime = new Date();
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.kpiInterval !== null) window.clearInterval(this.kpiInterval);
    if (this.timeInterval !== null) window.clearInterval(this.timeInterval);
  }

  get greeting(): string {
    const h = this.currentTime.getHours();
    const building = this.contextService.buildings().find(b => b.id === this.context().buildingId);
    const suffix = building ? ` en ${building.code}` : '';
    
    if (h < 12) return `Buenos días${suffix}`;
    if (h < 18) return `Buenas tardes${suffix}`;
    return `Buenas noches${suffix}`;
  }

  get formattedDate(): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).format(this.currentTime);
  }

  get formattedTime(): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(this.currentTime);
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
