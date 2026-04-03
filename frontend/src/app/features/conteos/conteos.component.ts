import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  ConteoDayLoad,
  ConteoLog,
  ConteoMaterial,
  ConteoParseMeta,
  ConteoSummary,
  DifficultyLevel,
} from './conteos.models';
import { ConteosService } from './conteos.service';

type LogFilter = 'todos' | 'pendiente' | 'completado' | 'desviacion' | 'critico';

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

@Component({
  selector: 'app-conteos',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  turnOptions: TurnOption[] = [
    { label: 'T1', enabled: true },
    { label: 'T2', enabled: true },
    { label: 'T3', enabled: false },
  ];

  logFilter: LogFilter = 'pendiente';
  searchTerm = '';
  dayFilter = 0;
  shiftFilter = 'todos';

  selectedLogId: string | null = null;
  physicalQuantity: number | null = null;
  observations = '';

  constructor(private readonly conteos: ConteosService) {
    this.syncState();
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
    this.syncState();
    this.pickNextPending();
  }

  clearAll(): void {
    this.conteos.reset();
    this.parseError = null;
    this.configDays = 5;
    this.searchTerm = '';
    this.dayFilter = 0;
    this.shiftFilter = 'todos';
    this.logFilter = 'pendiente';
    this.selectedLogId = null;
    this.physicalQuantity = null;
    this.observations = '';
    this.turnOptions = [
      { label: 'T1', enabled: true },
      { label: 'T2', enabled: true },
      { label: 'T3', enabled: false },
    ];
    this.syncState();
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

  get filteredLogs(): ConteoLogView[] {
    const term = this.searchTerm.trim().toUpperCase();
    return this.logViews
      .filter((log) => {
        if (this.logFilter === 'pendiente' && log.status !== 'pendiente') return false;
        if (this.logFilter === 'completado' && log.status === 'pendiente') return false;
        if (this.logFilter === 'desviacion' && log.status !== 'desviacion') return false;
        if (this.logFilter === 'critico' && log.status !== 'critico') return false;
        if (this.dayFilter && log.dia !== this.dayFilter) return false;
        if (this.shiftFilter !== 'todos' && log.turno !== this.shiftFilter) return false;
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

  get selectedLog(): ConteoLogView | null {
    return this.logViews.find((log) => log.id === this.selectedLogId) ?? null;
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

  statusClass(status: ConteoLog['status']): string {
    return `status-${status}`;
  }

  private loadFile(file: File): void {
    this.loading = true;
    this.parseError = null;
    this.conteos.parseExcel(file)
      .pipe(finalize(() => { this.loading = false; }))
      .subscribe({
        next: () => {
          this.syncState();
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
