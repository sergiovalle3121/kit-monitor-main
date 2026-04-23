import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';
import { finalize } from 'rxjs';
import * as XLSX from 'xlsx';

import {
  ConteoDayLoad,
  ConteoLog,
  ConteoMaterial,
  ConteoParseMeta,
  ConteoSummary,
  DifficultyLevel,
} from './conteos.models';
import { ConteosService } from './conteos.service';

type LogFilter = 'todos' | 'diferencias' | 'faltantes' | 'sobrantes';
type OperationalStatus =
  | 'scheduled'
  | 'in_progress'
  | 'counted'
  | 'variance_detected'
  | 'recount_required'
  | 'approved'
  | 'adjusted'
  | 'closed';

interface TurnOption {
  label: string;
  enabled: boolean;
}

interface ConteoLogView extends ConteoLog {
  difficulty: DifficultyLevel;
  difficultyScore: number;
  priorityScore: number;
  location2: string;
  bulk: boolean;
  familia: string;
}

interface ConteoSession {
  id: string;
  timestamp: string;
  fileName: string;
  kpis: {
    totalNps: number;
    squaredPct: number;
    missingUnits: number;
    excessUnits: number;
  };
  rows: ConteoLogView[];
}

interface CycleCountTimelineEvent {
  action: string;
  timestamp: string;
  actor: string;
  note?: string;
}

@Component({
  selector: 'app-conteos',
  standalone: true,
  imports: [EnterpriseContextBannerComponent, CommonModule, FormsModule],
  templateUrl: './conteos.component.html',
  styleUrls: ['./conteos.component.css'],
})
export class ConteosComponent {
  loading = false;
  parseError: string | null = null;

  materials: ConteoMaterial[] = [];
  logs: ConteoLog[] = [];
  parseMeta: ConteoParseMeta | null = null;
  summary: ConteoSummary = this.emptySummary();

  configDays = 5;
  countDate = new Date().toISOString().slice(0, 10);
  readonly location = '7BOX';
  turnOptions: TurnOption[] = [
    { label: 'T1', enabled: true },
    { label: 'T2', enabled: true },
    { label: 'T3', enabled: false },
  ];

  logFilter: LogFilter = 'diferencias';
  searchTerm = '';
  dayFilter = 0;
  shiftFilter = 'todos';
  statusFilter: 'todos' | OperationalStatus = 'todos';
  areaFilter = 'todos';
  ownerFilter = 'todos';
  highVarianceOnly = false;
  openOnly = true;
  ownerName = 'IC Supervisor';

  selectedLogId: string | null = null;
  physicalQuantity: number | null = null;
  observations = '';
  sessions: ConteoSession[] = [];
  selectedSessionId: string | null = null;
  private readonly sessionsKey = 'km_conteos_sessions_v1';
  private readonly statusByLogId = new Map<string, OperationalStatus>();
  private readonly ownerByLogId = new Map<string, string>();
  private readonly timelineByLogId = new Map<string, CycleCountTimelineEvent[]>();

  constructor(private readonly conteos: ConteosService) {
    this.syncState();
    this.loadSessions();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.loadFile(file);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.loadFile(file);
  }

  onFileDrag(event: DragEvent): void {
    event.preventDefault();
  }

  generatePlan(): void {
    const turnos = this.turnOptions.filter((option) => option.enabled).map((option) => option.label);
    if (!this.materials.length) {
      this.parseError = 'Carga primero el Excel SAP para generar la bitacora.';
      return;
    }

    if (!turnos.length) {
      this.parseError = 'Selecciona al menos un turno para repartir la carga.';
      return;
    }

    this.configDays = Math.max(1, Math.min(7, Math.round(this.configDays)));
    this.conteos.generatePlan({ days: this.configDays, turnos });
    this.parseError = null;
    this.syncState();
    this.pickNextPending();
    this.saveSessionSnapshot();
  }

  selectLog(logId: string): void {
    const log = this.logs.find((item) => item.id === logId);
    this.selectedLogId = logId;
    this.physicalQuantity = log?.physicalQuantity ?? null;
    this.observations = log?.observaciones ?? '';
  }

  saveCount(): void {
    if (!this.selectedLogId || this.physicalQuantity == null) return;
    this.conteos.registerCount(this.selectedLogId, this.physicalQuantity, this.observations.trim());
    const selected = this.logs.find((item) => item.id === this.selectedLogId);
    const hasVariance = Math.abs(Number(selected?.delta ?? 0)) > 0;
    this.setOperationalStatus(this.selectedLogId, hasVariance ? 'variance_detected' : 'counted', 'COUNT_SUBMITTED');
    this.recordTimeline(this.selectedLogId, hasVariance ? 'VARIANCE_DETECTED' : 'COUNT_SUBMITTED', this.observations.trim() || undefined);
    this.ownerByLogId.set(this.selectedLogId, this.ownerName.trim() || 'IC Supervisor');
    this.syncState();
    this.pickNextPending();
    this.saveSessionSnapshot();
  }

  clearAll(): void {
    this.conteos.reset();
    this.parseError = null;
    this.configDays = 5;
    this.searchTerm = '';
    this.dayFilter = 0;
    this.shiftFilter = 'todos';
    this.logFilter = 'diferencias';
    this.selectedLogId = null;
    this.physicalQuantity = null;
    this.observations = '';
    this.turnOptions = [
      { label: 'T1', enabled: true },
      { label: 'T2', enabled: true },
      { label: 'T3', enabled: false },
    ];
    this.syncState();
    this.selectedSessionId = null;
    this.statusByLogId.clear();
    this.ownerByLogId.clear();
    this.timelineByLogId.clear();
  }

  get previewMaterials(): ConteoMaterial[] {
    return this.materials.slice(0, 10);
  }

  get dayLoads(): ConteoDayLoad[] {
    return this.conteos.buildDayLoads();
  }

  get deltaBuckets() {
    return this.conteos.buildDeltaBuckets();
  }

  get locationSummary() {
    return this.conteos.buildLocationSummary();
  }

  get completionPct(): number {
    return this.summary.total ? Math.round((this.summary.completed / this.summary.total) * 100) : 0;
  }

  get deviationPct(): number {
    return this.summary.completed
      ? Math.round((((this.summary.desviacion + this.summary.critico) / this.summary.completed) * 100))
      : 0;
  }

  get totalSapUnits(): number {
    return this.logs.reduce((sum, log) => sum + Number(log.sapQuantity ?? 0), 0);
  }

  get totalPhysicalUnits(): number {
    return this.logs.reduce((sum, log) => sum + Number(log.physicalQuantity ?? 0), 0);
  }

  get totalMissingUnits(): number {
    return this.logs.reduce((sum, log) => sum + Math.abs(Math.min(0, Number(log.delta ?? 0))), 0);
  }

  get totalExcessUnits(): number {
    return this.logs.reduce((sum, log) => sum + Math.max(0, Number(log.delta ?? 0)), 0);
  }

  get pendingApprovals(): number {
    return this.logViews.filter((log) => this.getOperationalStatus(log) === 'variance_detected').length;
  }

  get highVarianceCounts(): number {
    return this.logViews.filter((log) => this.isHighVariance(log)).length;
  }

  get discrepancyRate(): number {
    const completed = this.logViews.filter((log) => this.getOperationalStatus(log) !== 'scheduled').length;
    if (!completed) return 0;
    const withVariance = this.logViews.filter((log) => this.isVariance(log)).length;
    return Math.round((withVariance / completed) * 100);
  }

  get inventoryAccuracyPct(): number {
    return this.summary.accuracyPct;
  }

  get countsByAreaLabel(): string {
    const byArea = new Map<string, number>();
    for (const log of this.logViews) {
      const key = this.resolveArea(log.location);
      byArea.set(key, (byArea.get(key) ?? 0) + 1);
    }
    return Array.from(byArea.entries()).slice(0, 3).map(([area, count]) => `${area}: ${count}`).join(' · ') || 'Sin datos';
  }

  get countsByLineLabel(): string {
    const byLine = new Map<string, number>();
    for (const log of this.logViews) {
      const key = `L${((log.dia - 1) % 7) + 1}`;
      byLine.set(key, (byLine.get(key) ?? 0) + 1);
    }
    return Array.from(byLine.entries()).slice(0, 3).map(([line, count]) => `${line}: ${count}`).join(' · ') || 'Sin datos';
  }

  get countsByWarehouseLabel(): string {
    const map = new Map<string, number>();
    for (const log of this.logViews) {
      const wh = this.resolveWarehouse(log.location);
      map.set(wh, (map.get(wh) ?? 0) + 1);
    }
    return Array.from(map.entries()).slice(0, 3).map(([wh, count]) => `${wh}: ${count}`).join(' · ') || 'Sin datos';
  }

  get variationUnits(): number {
    return Math.round((this.totalPhysicalUnits - this.totalSapUnits) * 100) / 100;
  }

  get squaredPct(): number {
    return this.summary.completed ? Math.round((this.summary.ok / this.summary.completed) * 100) : 0;
  }

  get filteredLogs(): ConteoLogView[] {
    const source = this.selectedSession?.rows ?? this.logViews;
    const term = this.searchTerm.trim().toUpperCase();
    return source
      .filter((log) => {
        if (this.logFilter === 'diferencias' && Number(log.delta ?? 0) === 0) return false;
        if (this.logFilter === 'faltantes' && Number(log.delta ?? 0) >= 0) return false;
        if (this.logFilter === 'sobrantes' && Number(log.delta ?? 0) <= 0) return false;
        if (this.dayFilter && log.dia !== this.dayFilter) return false;
        if (this.shiftFilter !== 'todos' && log.turno !== this.shiftFilter) return false;
        if (this.statusFilter !== 'todos' && this.getOperationalStatus(log) !== this.statusFilter) return false;
        if (this.areaFilter !== 'todos' && this.resolveArea(log.location) !== this.areaFilter) return false;
        if (this.ownerFilter !== 'todos' && this.ownerForLog(log) !== this.ownerFilter) return false;
        if (this.highVarianceOnly && !this.isHighVariance(log)) return false;
        if (this.openOnly && this.getOperationalStatus(log) === 'closed') return false;
        if (!term) return true;
        return [log.material, log.descripcion, log.location, log.location2, log.familia]
          .join(' ')
          .toUpperCase()
          .includes(term);
      })
      .sort((left, right) => this.statusRank(left.status) - this.statusRank(right.status)
        || left.dia - right.dia
        || left.turno.localeCompare(right.turno)
        || right.priorityScore - left.priorityScore);
  }

  get selectedSession(): ConteoSession | null {
    return this.sessions.find((session) => session.id === this.selectedSessionId) ?? null;
  }

  get isHistoryMode(): boolean {
    return !!this.selectedSession;
  }

  get selectedLog(): ConteoLogView | null {
    return this.logViews.find((log) => log.id === this.selectedLogId) ?? null;
  }

  get statusOptions(): OperationalStatus[] {
    return ['scheduled', 'in_progress', 'counted', 'variance_detected', 'recount_required', 'approved', 'adjusted', 'closed'];
  }

  get areaOptions(): string[] {
    return Array.from(new Set(this.logViews.map((log) => this.resolveArea(log.location)))).sort();
  }

  get ownerOptions(): string[] {
    return Array.from(new Set(this.logViews.map((log) => this.ownerForLog(log)))).sort();
  }

  get statusBoard(): Array<{ status: OperationalStatus; label: string; total: number; logs: ConteoLogView[] }> {
    return this.statusOptions.map((status) => {
      const logs = this.logViews.filter((log) => this.getOperationalStatus(log) === status);
      return {
        status,
        label: this.operationalStatusLabel(status),
        total: logs.length,
        logs: logs.slice(0, 4),
      };
    });
  }

  get shiftOptions(): string[] {
    const values = new Set<string>();
    for (const day of this.dayLoads) {
      for (const turno of day.turnos) values.add(turno.turno);
    }
    return values.size ? Array.from(values) : this.turnOptions.map((option) => option.label);
  }

  get strongestDayLoad(): number {
    return Math.max(...this.dayLoads.map((day) => day.totalWeight), 1);
  }

  get strongestLocationIssues(): number {
    return Math.max(...this.locationSummary.map((item) => item.desviacion + item.critico + item.pending), 1);
  }

  difficultyClass(level: DifficultyLevel): string {
    return `difficulty-${level}`;
  }

  operationalStatusLabel(status: OperationalStatus): string {
    const labels: Record<OperationalStatus, string> = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      counted: 'Counted',
      variance_detected: 'Variance Detected',
      recount_required: 'Recount Required',
      approved: 'Approved',
      adjusted: 'Adjusted',
      closed: 'Closed',
    };
    return labels[status];
  }

  operationalStatusClass(status: OperationalStatus): string {
    return `op-${status}`;
  }

  selectedStatus(): OperationalStatus {
    return this.selectedLog ? this.getOperationalStatus(this.selectedLog) : 'scheduled';
  }

  canStartCount(log: ConteoLogView | null): boolean {
    return !!log && this.getOperationalStatus(log) === 'scheduled' && !this.isHistoryMode;
  }

  canSubmitCount(log: ConteoLogView | null): boolean {
    return !!log && ['in_progress', 'recount_required'].includes(this.getOperationalStatus(log)) && !this.isHistoryMode;
  }

  canRequestRecount(log: ConteoLogView | null): boolean {
    return !!log && ['variance_detected', 'counted'].includes(this.getOperationalStatus(log)) && !this.isHistoryMode;
  }

  canApproveVariance(log: ConteoLogView | null): boolean {
    return !!log && this.getOperationalStatus(log) === 'variance_detected' && !this.isHistoryMode;
  }

  canAdjustInventory(log: ConteoLogView | null): boolean {
    return !!log && this.getOperationalStatus(log) === 'approved' && this.isVariance(log) && !this.isHistoryMode;
  }

  canCloseCount(log: ConteoLogView | null): boolean {
    return !!log && ['approved', 'adjusted', 'counted'].includes(this.getOperationalStatus(log)) && !this.isHistoryMode;
  }

  startCount(): void {
    if (!this.selectedLogId) return;
    this.setOperationalStatus(this.selectedLogId, 'in_progress', 'COUNT_STARTED');
    this.recordTimeline(this.selectedLogId, 'COUNT_STARTED');
  }

  submitCycleCount(): void {
    if (!this.selectedLogId) return;
    if (this.physicalQuantity != null) {
      this.saveCount();
      return;
    }
    this.setOperationalStatus(this.selectedLogId, 'counted', 'COUNT_SUBMITTED');
    this.recordTimeline(this.selectedLogId, 'COUNT_SUBMITTED');
  }

  requestRecount(): void {
    if (!this.selectedLogId) return;
    this.setOperationalStatus(this.selectedLogId, 'recount_required', 'RECOUNT_REQUESTED');
    this.recordTimeline(this.selectedLogId, 'RECOUNT_REQUESTED', this.observations.trim() || undefined);
  }

  approveVariance(): void {
    if (!this.selectedLogId) return;
    this.setOperationalStatus(this.selectedLogId, 'approved', 'COUNT_APPROVED');
    this.recordTimeline(this.selectedLogId, 'COUNT_APPROVED');
  }

  adjustInventory(): void {
    if (!this.selectedLogId) return;
    this.setOperationalStatus(this.selectedLogId, 'adjusted', 'INVENTORY_ADJUSTED');
    this.recordTimeline(this.selectedLogId, 'INVENTORY_ADJUSTED');
  }

  closeCount(): void {
    if (!this.selectedLogId) return;
    this.setOperationalStatus(this.selectedLogId, 'closed', 'COUNT_CLOSED');
    this.recordTimeline(this.selectedLogId, 'COUNT_CLOSED');
  }

  timelineForSelected(): CycleCountTimelineEvent[] {
    if (!this.selectedLogId) return [];
    return this.timelineByLogId.get(this.selectedLogId) ?? [];
  }

  ownerForLog(log: ConteoLogView): string {
    return this.ownerByLogId.get(log.id) ?? 'IC Team';
  }

  statusClass(status: ConteoLog['status']): string {
    return `status-${status}`;
  }

  severityLabel(log: ConteoLog): string {
    const delta = Number(log.delta ?? 0);
    if (delta === 0) return 'Cuadrado';
    return delta < 0 ? 'Faltante' : 'Sobrante';
  }

  severityClass(log: ConteoLog): string {
    const delta = Number(log.delta ?? 0);
    if (delta === 0) return 'sev-ok';
    return delta < 0 ? 'sev-missing' : 'sev-excess';
  }

  exportSession(): void {
    const rows = this.filteredLogs.map((log) => ({
      NP: log.material,
      Descripción: log.descripcion || '',
      QtySAP: log.sapQuantity,
      QtyFísica: log.physicalQuantity ?? '',
      Delta: log.delta ?? '',
      Severidad: this.severityLabel(log),
      Comentario: log.observaciones ?? '',
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Conteo');
    XLSX.writeFile(book, `conteo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`);
  }

  openSession(sessionId: string): void {
    this.selectedSessionId = sessionId;
  }

  backToLive(): void {
    this.selectedSessionId = null;
  }

  private loadFile(file: File): void {
    this.loading = true;
    this.parseError = null;
    this.conteos.parseExcel(file)
      .pipe(finalize(() => { this.loading = false; }))
      .subscribe({
        next: () => {
          this.syncState();
          for (const log of this.logs) {
            this.setOperationalStatus(log.id, 'scheduled');
            this.recordTimeline(log.id, 'COUNT_CREATED', 'Loaded from SAP workbook');
          }
          this.selectedLogId = null;
          this.physicalQuantity = null;
          this.observations = '';
        },
        error: (error) => {
          this.parseError = error instanceof Error ? error.message : 'No se pudo procesar el archivo.';
          this.syncState();
        },
      });
  }

  private syncState(): void {
    this.materials = this.conteos.materials;
    this.logs = this.conteos.logs;
    this.parseMeta = this.conteos.parseMeta;
    this.summary = this.conteos.getSummary();
  }

  private saveSessionSnapshot(): void {
    if (!this.logs.length) return;
    const session: ConteoSession = {
      id: `session-${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName: this.parseMeta?.fileName ?? 'Sin archivo',
      kpis: {
        totalNps: this.parseMeta?.recordCount ?? this.logs.length,
        squaredPct: this.squaredPct,
        missingUnits: this.totalMissingUnits,
        excessUnits: this.totalExcessUnits,
      },
      rows: this.logViews,
    };

    this.sessions = [session, ...this.sessions].slice(0, 30);
    localStorage.setItem(this.sessionsKey, JSON.stringify(this.sessions));
  }

  private loadSessions(): void {
    const raw = localStorage.getItem(this.sessionsKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ConteoSession[];
      this.sessions = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.sessions = [];
    }
  }

  private pickNextPending(): void {
    const next = this.logs.find((log) => log.status === 'pendiente') ?? this.logs[0] ?? null;
    if (!next) {
      this.selectedLogId = null;
      this.physicalQuantity = null;
      this.observations = '';
      return;
    }
    this.selectLog(next.id);
  }

  private get logViews(): ConteoLogView[] {
    return this.logs.map((log) => {
      const material = this.materials.find((item) => item.id === log.materialId);
      return {
        ...log,
        difficulty: material?.difficulty ?? 'media',
        difficultyScore: material?.difficultyScore ?? 0,
        priorityScore: material?.priorityScore ?? 0,
        location2: material?.location2 ?? '',
        bulk: material?.bulk ?? false,
        familia: material?.familia ?? '',
      };
    });
  }

  private statusRank(status: ConteoLog['status']): number {
    if (status === 'pendiente') return 0;
    if (status === 'critico') return 1;
    if (status === 'desviacion') return 2;
    return 3;
  }

  private getOperationalStatus(log: ConteoLogView): OperationalStatus {
    if (this.statusByLogId.has(log.id)) return this.statusByLogId.get(log.id)!;
    if (log.status === 'pendiente') return 'scheduled';
    if (log.status === 'ok') return 'counted';
    if (log.status === 'desviacion' || log.status === 'critico') return 'variance_detected';
    return 'scheduled';
  }

  private setOperationalStatus(logId: string, status: OperationalStatus, timelineAction?: string): void {
    this.statusByLogId.set(logId, status);
    if (timelineAction) this.recordTimeline(logId, timelineAction);
  }

  private recordTimeline(logId: string, action: string, note?: string): void {
    const current = this.timelineByLogId.get(logId) ?? [];
    current.unshift({
      action,
      timestamp: new Date().toISOString(),
      actor: this.ownerName.trim() || 'IC Supervisor',
      note,
    });
    this.timelineByLogId.set(logId, current.slice(0, 18));
  }

  private resolveWarehouse(location: string): string {
    const value = (location || '').toUpperCase();
    if (value.includes('7BOX')) return 'WH-7BOX';
    if (value.includes('SUP')) return 'WH-SUP';
    return 'WH-MAIN';
  }

  private resolveArea(location: string): string {
    const value = (location || '').toUpperCase();
    if (value.includes('RACK')) return 'RACK';
    if (value.includes('SUP')) return 'SUPERMARKET';
    if (value.includes('LINE')) return 'LINE-FEED';
    return 'GENERAL';
  }

  private isVariance(log: ConteoLogView): boolean {
    return Math.abs(Number(log.delta ?? 0)) > 0;
  }

  private isHighVariance(log: ConteoLogView): boolean {
    return Math.abs(Number(log.deltaPct ?? 0)) >= 20 || Math.abs(Number(log.delta ?? 0)) >= 25;
  }

  private emptySummary(): ConteoSummary {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      ok: 0,
      desviacion: 0,
      critico: 0,
      accuracyPct: 0,
    };
  }
}
