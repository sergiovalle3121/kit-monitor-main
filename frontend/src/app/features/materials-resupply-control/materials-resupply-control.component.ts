import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

type UiStatus = 'requested' | 'acknowledged' | 'pick_started' | 'pick_completed' | 'in_transit' | 'delivered' | 'confirmed' | 'escalated' | 'cancelled';
type UiPriority = 'low' | 'medium' | 'high' | 'critical';
type SlaState = 'on_track' | 'at_risk' | 'overdue';

interface ResupplyItem {
  id: number;
  status: UiStatus;
  priority: UiPriority;
  partNumber: string;
  description?: string;
  quantityRequested: number;
  quantityDelivered?: number;
  ownerId?: string;
  ownerName?: string;
  reason?: string;
  requestedAt?: string;
  acknowledgedAt?: string;
  pickStartedAt?: string;
  pickCompletedAt?: string;
  deliveredAt?: string;
  confirmedAt?: string;
  escalatedAt?: string;
  cancelledAt?: string;
  kit?: { id?: number; plan?: any };
}

@Component({
  selector: 'app-materials-resupply-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './materials-resupply-control.component.html',
  styleUrl: './materials-resupply-control.component.css',
})
export class MaterialsResupplyControlComponent implements OnInit {
  loading = false;
  error = '';
  viewMode: 'board' | 'list' = 'board';
  selected: ResupplyItem | null = null;
  selectedTimeline: any[] = [];
  processingId: number | null = null;
  assigningOwner = false;
  ownerDraft = '';

  rows: ResupplyItem[] = [];
  filteredRows: ResupplyItem[] = [];

  filters = {
    q: '',
    line: '',
    model: '',
    workOrder: '',
    status: '',
    priority: '',
  };

  readonly boardColumns = [
    { key: 'requested', label: 'Requested', statuses: ['requested'] as UiStatus[] },
    { key: 'acknowledged', label: 'Acknowledged', statuses: ['acknowledged'] as UiStatus[] },
    { key: 'picking', label: 'Picking', statuses: ['pick_started', 'pick_completed', 'in_transit'] as UiStatus[] },
    { key: 'delivered', label: 'Delivered', statuses: ['delivered'] as UiStatus[] },
    { key: 'confirmed', label: 'Confirmed', statuses: ['confirmed'] as UiStatus[] },
    { key: 'escalated', label: 'Escalated', statuses: ['escalated'] as UiStatus[] },
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.api.getAllResupplies().subscribe({
      next: (rows) => {
        this.rows = (rows ?? []).map((it) => ({ ...it }));
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.rows = [];
        this.filteredRows = [];
        this.loading = false;
        this.error = err?.error?.message ?? 'No fue posible cargar Materials / Resupply Control';
      },
    });
  }

  applyFilters(): void {
    const q = this.filters.q.trim().toUpperCase();
    this.filteredRows = this.rows.filter((row) => {
      const line = this.safe(row.kit?.plan?.line);
      const model = this.safe(row.kit?.plan?.model);
      const wo = this.safe(row.kit?.plan?.workOrder);

      if (this.filters.line && line !== this.filters.line) return false;
      if (this.filters.model && model !== this.filters.model) return false;
      if (this.filters.workOrder && wo !== this.filters.workOrder) return false;
      if (this.filters.status && row.status !== this.filters.status) return false;
      if (this.filters.priority && row.priority !== this.filters.priority) return false;

      if (!q) return true;
      return [
        row.partNumber,
        row.description,
        row.ownerName,
        line,
        model,
        wo,
        row.status,
        row.priority,
      ].some((value) => this.safe(value).includes(q));
    });
  }

  openDetail(item: ResupplyItem): void {
    this.selected = item;
    this.ownerDraft = item.ownerName ?? '';
    this.selectedTimeline = [];
    this.api.getLedgerEvents('RESUPPLY', item.id).subscribe({
      next: (events) => this.selectedTimeline = events ?? [],
      error: () => this.selectedTimeline = [],
    });
  }

  closeDetail(): void {
    this.selected = null;
    this.ownerDraft = '';
    this.selectedTimeline = [];
  }

  assignOwner(): void {
    if (!this.selected || !this.ownerDraft.trim() || this.assigningOwner) return;

    this.assigningOwner = true;
    const ownerName = this.ownerDraft.trim();
    this.api.assignResupplyOwner(this.selected.id, {
      ownerName,
      ownerId: ownerName.toLowerCase().replace(/\s+/g, '_'),
      actorName: 'AXOS Dispatcher',
    }).subscribe({
      next: (updated) => {
        this.rows = this.rows.map((row) => row.id === updated.id ? { ...row, ...updated } : row);
        this.applyFilters();
        this.openDetail({ ...(this.selected ?? updated), ...updated });
        this.assigningOwner = false;
      },
      error: () => {
        this.assigningOwner = false;
      },
    });
  }

  runAction(item: ResupplyItem, action: UiStatus): void {
    if (!this.canTransition(item.status, action) || this.processingId) return;

    let reason: string | undefined;
    if (action === 'escalated' || action === 'cancelled') {
      reason = window.prompt(`Reason for ${action}`, item.reason ?? '')?.trim() ?? '';
    }

    const quantityDelivered = action === 'delivered'
      ? (item.quantityDelivered ?? item.quantityRequested)
      : undefined;

    this.processingId = item.id;
    this.api.updateResupplyStatus(item.id, {
      status: action,
      actorName: 'AXOS Operator',
      reason,
      quantityDelivered,
    }).subscribe({
      next: (updated) => {
        this.rows = this.rows.map((row) => row.id === item.id ? { ...row, ...updated } : row);
        this.applyFilters();
        if (this.selected?.id === item.id) {
          this.openDetail({ ...(this.selected ?? item), ...updated });
        }
        this.processingId = null;
      },
      error: () => {
        this.processingId = null;
      },
    });
  }

  kpiOpenRequests(): number {
    return this.rows.filter((r) => !['confirmed', 'cancelled'].includes(r.status)).length;
  }

  kpiOverdueRequests(): number {
    return this.rows.filter((r) => this.slaState(r) === 'overdue' && !['confirmed', 'cancelled'].includes(r.status)).length;
  }

  kpiAvgAckMins(): number {
    const vals = this.rows.filter((r) => r.requestedAt && r.acknowledgedAt).map((r) => this.diffMinutes(r.requestedAt!, r.acknowledgedAt!));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }

  kpiAvgDeliveryMins(): number {
    const vals = this.rows.filter((r) => r.requestedAt && r.deliveredAt).map((r) => this.diffMinutes(r.requestedAt!, r.deliveredAt!));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }

  kpiEscalatedToday(): number {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    return this.rows.filter((r) => r.escalatedAt && new Date(r.escalatedAt).getTime() >= day.getTime()).length;
  }

  kpiRequestsByLine(): string {
    const byLine = this.filteredRows.reduce((acc, row) => {
      const line = row.kit?.plan?.line ? `L${row.kit.plan.line}` : 'N/A';
      acc[line] = (acc[line] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(byLine).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([line, count]) => `${line}: ${count}`).join(' · ') || 'No active lines';
  }

  lineOptions(): string[] {
    return [...new Set(this.rows.map((r) => this.safe(r.kit?.plan?.line)).filter(Boolean))];
  }

  modelOptions(): string[] {
    return [...new Set(this.rows.map((r) => this.safe(r.kit?.plan?.model)).filter(Boolean))];
  }

  workOrderOptions(): string[] {
    return [...new Set(this.rows.map((r) => this.safe(r.kit?.plan?.workOrder)).filter(Boolean))];
  }

  rowsForColumn(statuses: UiStatus[]): ResupplyItem[] {
    return this.filteredRows.filter((row) => statuses.includes(row.status));
  }

  ageLabel(row: ResupplyItem): string {
    if (!row.requestedAt) return 'n/a';
    const minutes = this.diffMinutes(row.requestedAt, new Date().toISOString());
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  timestamp(v?: string): string {
    if (!v) return '—';
    return new Date(v).toLocaleString();
  }

  statusLabel(status: UiStatus): string {
    return {
      requested: 'Requested',
      acknowledged: 'Acknowledged',
      pick_started: 'Picking started',
      pick_completed: 'Picking completed',
      in_transit: 'In transit',
      delivered: 'Delivered',
      confirmed: 'Confirmed by line',
      escalated: 'Escalated',
      cancelled: 'Cancelled',
    }[status];
  }

  slaState(row: ResupplyItem): SlaState {
    const elapsed = row.requestedAt ? this.diffMinutes(row.requestedAt, new Date().toISOString()) : 0;
    const target = this.slaTargetMins(row.priority);
    if (elapsed > target) return 'overdue';
    if (elapsed > target * 0.75) return 'at_risk';
    return 'on_track';
  }

  slaLabel(row: ResupplyItem): string {
    const target = this.slaTargetMins(row.priority);
    return `${this.statusCase(this.slaState(row))} · target ${target}m`;
  }

  statusCase(v: string): string {
    return v.replace('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  allowedActions(status: UiStatus): Array<{ label: string; to: UiStatus; tone?: 'danger' | 'warn' }> {
    const all = {
      requested: [
        { label: 'Acknowledge', to: 'acknowledged' as UiStatus },
        { label: 'Escalate', to: 'escalated' as UiStatus, tone: 'warn' as const },
        { label: 'Cancel', to: 'cancelled' as UiStatus, tone: 'danger' as const },
      ],
      acknowledged: [
        { label: 'Start pick', to: 'pick_started' as UiStatus },
        { label: 'Escalate', to: 'escalated' as UiStatus, tone: 'warn' as const },
        { label: 'Cancel', to: 'cancelled' as UiStatus, tone: 'danger' as const },
      ],
      pick_started: [
        { label: 'Complete pick', to: 'pick_completed' as UiStatus },
        { label: 'Escalate', to: 'escalated' as UiStatus, tone: 'warn' as const },
      ],
      pick_completed: [
        { label: 'Mark delivered', to: 'delivered' as UiStatus },
      ],
      in_transit: [
        { label: 'Mark delivered', to: 'delivered' as UiStatus },
        { label: 'Escalate', to: 'escalated' as UiStatus, tone: 'warn' as const },
      ],
      delivered: [
        { label: 'Confirm by line', to: 'confirmed' as UiStatus },
        { label: 'Escalate', to: 'escalated' as UiStatus, tone: 'warn' as const },
      ],
      confirmed: [],
      escalated: [
        { label: 'Acknowledge', to: 'acknowledged' as UiStatus },
        { label: 'Cancel', to: 'cancelled' as UiStatus, tone: 'danger' as const },
      ],
      cancelled: [],
    } as Record<UiStatus, Array<{ label: string; to: UiStatus; tone?: 'danger' | 'warn' }>>;

    return all[status] ?? [];
  }

  canTransition(from: UiStatus, to: UiStatus): boolean {
    return this.allowedActions(from).some((a) => a.to === to);
  }

  private diffMinutes(from: string, to: string): number {
    return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  }

  private slaTargetMins(priority: UiPriority): number {
    return { critical: 25, high: 45, medium: 75, low: 120 }[priority] ?? 75;
  }

  private safe(value: unknown): string {
    return `${value ?? ''}`.trim().toUpperCase();
  }
}
