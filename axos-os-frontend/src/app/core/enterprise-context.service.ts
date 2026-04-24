import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EnterpriseContextState {
  campusId: string;
  buildingId?: string;
  warehouseId?: string;
  customerId?: string;
  programId?: string;
  model?: string;
  lineId?: string;
  workOrder?: string;
  isConfigured: boolean;
}

@Injectable({ providedIn: 'root' })
export class EnterpriseContextService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'axos.enterprise.context';
  private readonly apiBase = `${environment.apiUrl || '/api'}/enterprise`;
  private readonly _context = signal<EnterpriseContextState>(this.loadInitial());
  readonly context = computed(() => this._context());

  readonly buildings = signal<any[]>([]);
  readonly warehouses = signal<any[]>([]);
  readonly customers = signal<any[]>([]);
  readonly programs = signal<any[]>([]);
  readonly lines = signal<any[]>([]);

  async preload(): Promise<void> {
    try {
      const [buildings, warehouses, customers, programs, lines] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(`${this.apiBase}/buildings`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiBase}/warehouses`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiBase}/customers`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiBase}/programs`)),
        firstValueFrom(this.http.get<any[]>(`${this.apiBase}/lines`)),
      ]);

      this.buildings.set(buildings ?? []);
      this.warehouses.set(warehouses ?? []);
      this.customers.set(customers ?? []);
      this.programs.set(programs ?? []);
      this.lines.set(lines ?? []);
    } catch {
      // keep continuity if enterprise APIs unavailable
    }
  }

  update(partial: Partial<EnterpriseContextState>): void {
    const next = { ...this._context(), ...partial };
    this._context.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  clear(): void {
    const base: EnterpriseContextState = { campusId: 'jbl-gdl', isConfigured: false };
    this._context.set(base);
    localStorage.setItem(this.storageKey, JSON.stringify(base));
  }

  lineMatches(line: string | number | undefined): boolean {
    const selectedLineId = this._context().lineId;
    if (!selectedLineId || line === undefined || line === null) return true;
    const lineRef = this.lines().find((entry) => entry.id === selectedLineId);
    if (!lineRef) return true;
    const normalized = String(line).trim();
    if (lineRef.code && normalized === String(lineRef.code)) return true;
    if (lineRef.legacyLineNumber != null && normalized === String(lineRef.legacyLineNumber)) return true;
    return false;
  }

  modelMatches(model?: string): boolean {
    const selected = this._context().model?.trim().toUpperCase();
    if (!selected) return true;
    return (model ?? '').toUpperCase().includes(selected);
  }

  workOrderMatches(workOrder?: string): boolean {
    const selected = this._context().workOrder?.trim().toUpperCase();
    if (!selected) return true;
    return (workOrder ?? '').toUpperCase().includes(selected);
  }

  programMatches(model?: string): boolean {
    const selectedProgram = this._context().programId;
    if (!selectedProgram) return true;
    const program = this.programs().find((entry) => entry.id === selectedProgram);
    if (!program) return true;
    const prefix = String(program.primaryModelPrefix ?? '').toUpperCase();
    if (!prefix) return true;
    return (model ?? '').toUpperCase().startsWith(prefix);
  }

  buildingMatches(line: string | number | undefined): boolean {
    const buildingId = this._context().buildingId;
    if (!buildingId) return true;
    const lineId = this.resolveLineId(line);
    if (!lineId) return true;
    const lineRef = this.lines().find((entry) => entry.id === lineId);
    return !lineRef || lineRef.building?.id === buildingId || lineRef.buildingId === buildingId;
  }

  private resolveLineId(line: string | number | undefined): string | null {
    if (line === undefined || line === null) return null;
    const normalized = String(line).trim();
    const byId = this.lines().find((entry) => entry.id === normalized);
    if (byId) return byId.id;
    const byCode = this.lines().find((entry) => String(entry.code) === normalized);
    if (byCode) return byCode.id;
    const byLegacy = this.lines().find((entry) => entry.legacyLineNumber != null && String(entry.legacyLineNumber) === normalized);
    return byLegacy?.id ?? null;
  }

  private loadInitial(): EnterpriseContextState {
    const base: EnterpriseContextState = { campusId: 'jbl-gdl', isConfigured: false };
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return base;
    try {
      const parsed = JSON.parse(raw);
      // If we have building and program, consider it configured if not explicitly set
      if (parsed.buildingId && parsed.programId && parsed.isConfigured === undefined) {
        parsed.isConfigured = true;
      }
      return { ...base, ...parsed };
    } catch {
      return base;
    }
  }
}
