import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer, map } from 'rxjs';
import * as XLSX from 'xlsx';

import {
  ConteoDayLoad,
  ConteoDeltaBucket,
  ConteoLocationSummary,
  ConteoLog,
  ConteoMaterial,
  ConteoParseMeta,
  ConteoSummary,
  ConteoTurnoLoad,
  DifficultyLevel,
  PlanConfig,
} from './conteos.models';

type ConteoColumn =
  | 'material'
  | 'descripcion'
  | 'ubicacion'
  | 'ubicacion2'
  | 'cantMax'
  | 'cantMin'
  | 'precio'
  | 'bulk'
  | 'familia'
  | 'tipo'
  | 'nivelProceso'
  | 'presentacion';

type DetectedColumns = Partial<Record<ConteoColumn, string>>;

interface ParsedSheetCandidate {
  sheetName: string;
  headerRow: number;
  detectedColumns: DetectedColumns;
  materials: ConteoMaterial[];
  rowCount: number;
  score: number;
}

@Injectable({ providedIn: 'root' })
export class ConteosService {
  private static readonly COL: Record<ConteoColumn, string[]> = {
    material: ['material', 'np', 'part number', 'part no', 'numero de parte', 'stock material', 'codigo'],
    descripcion: ['descripcion', 'description', 'texto breve material', 'short text', 'material description'],
    ubicacion: ['ubicacion', 'localidad', 'location', 'storage bin', 'storage location', 'bin'],
    ubicacion2: ['ubicacion 2', 'rack', 'pasillo', 'bin 2', 'storage location (stock identifier)'],
    cantMax: ['cantidad sap', 'sap qty', 'sap quantity', 'cantidad', 'qty', 'quantity', 'cant max', 'unrestricted', 'total stock'],
    cantMin: ['cant min', 'min', 'minimo', 'minimum'],
    precio: ['precio', 'price', 'costo', 'cost', 'importe'],
    bulk: ['bulk', 'granel', 'a granel', 'volumen'],
    familia: ['familia', 'family', 'commodity'],
    tipo: ['tipo', 'type', 'material type'],
    nivelProceso: ['nivel proceso', 'process', 'proceso'],
    presentacion: ['presentacion', 'presentation', 'container', 'package'],
  };

  private static readonly EASY = ['screw', 'washer', 'label', 'nut', 'clip', 'o-ring', 'orings', 'tornillo', 'arandela', 'etiqueta'];
  private static readonly MED = ['cable', 'switch', 'speaker', 'lens', 'lightpipe', 'assy', 'case', 'housing', 'arnes'];
  private static readonly HARD = ['resina', 'bulk', 'granel', 'powder', 'liquid', 'adhesive', 'foam', 'mamp', 'mampa', 'panel'];

  private readonly materialsSubject = new BehaviorSubject<ConteoMaterial[]>([]);
  private readonly logsSubject = new BehaviorSubject<ConteoLog[]>([]);
  private readonly parseMetaSubject = new BehaviorSubject<ConteoParseMeta | null>(null);

  get materials(): ConteoMaterial[] {
    return this.materialsSubject.value;
  }

  get logs(): ConteoLog[] {
    return this.logsSubject.value;
  }

  get parseMeta(): ConteoParseMeta | null {
    return this.parseMetaSubject.value;
  }

  parseExcel(file: File): Observable<void> {
    return defer(() => file.arrayBuffer()).pipe(
      map((buffer) => {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const candidates = workbook.SheetNames
          .map((sheetName) => this.parseSheetCandidate(workbook.Sheets[sheetName], sheetName))
          .filter((candidate): candidate is ParsedSheetCandidate => !!candidate)
          .sort((left, right) => right.score - left.score);

        if (!candidates.length) {
          throw new Error('No se detectaron columnas suficientes para Material, localidad y cantidad SAP.');
        }

        const primary = candidates[0];
        const mergedMaterials = this.mergeMaterials(candidates.flatMap((candidate) => candidate.materials));
        const warnings: string[] = [];

        if (candidates.length > 1) {
          warnings.push(`Se fusionaron ${candidates.length} hojas compatibles; base principal: ${primary.sheetName}.`);
        }

        if (mergedMaterials.length < primary.materials.length) {
          warnings.push('Se consolidaron materiales repetidos por NP y localidad.');
        }

        this.materialsSubject.next(mergedMaterials);
        this.logsSubject.next([]);
        this.parseMetaSubject.next({
          fileName: file.name,
          sheetNames: workbook.SheetNames,
          primarySheet: primary.sheetName,
          headerRow: primary.headerRow + 1,
          detectedColumns: Object.entries(primary.detectedColumns)
            .filter(([, column]) => !!column)
            .map(([field, column]) => `${field}: ${column}`),
          warnings,
          recordCount: mergedMaterials.length,
        });
      }),
    );
  }

  generatePlan(cfg: PlanConfig): void {
    const materials = [...this.materials].sort((left, right) =>
      right.priorityScore - left.priorityScore || right.difficultyScore - left.difficultyScore || left.material.localeCompare(right.material),
    );

    if (!materials.length) {
      this.logsSubject.next([]);
      return;
    }

    const days = Math.max(1, Math.min(7, Math.round(cfg.days || 1)));
    const turnos = cfg.turnos.length ? cfg.turnos : ['T1'];
    const slotLoads = Array.from({ length: days }, (_, dayIndex) =>
      turnos.map((turno) => ({
        dia: dayIndex + 1,
        turno,
        weight: 0,
      })),
    ).flat();

    const logs: ConteoLog[] = materials.map((material, index) => {
      const slot = [...slotLoads].sort((left, right) => left.weight - right.weight || left.dia - right.dia)[0];
      slot.weight += this.difficultyWeight(material.difficulty) + Math.max(1, Math.round(material.priorityScore / 25));

      return {
        id: `CTL-${String(index + 1).padStart(4, '0')}`,
        materialId: material.id,
        material: material.material,
        descripcion: material.descripcion,
        location: material.location,
        sapQuantity: material.sapQuantity,
        physicalQuantity: null,
        delta: null,
        deltaPct: null,
        status: 'pendiente',
        dia: slot.dia,
        fecha: this.planDate(slot.dia),
        turno: slot.turno,
        observaciones: '',
      };
    });

    this.logsSubject.next(logs);
  }

  registerCount(logId: string, physicalQuantity: number, observaciones: string): void {
    const nextLogs = this.logs.map((log) => {
      if (log.id !== logId) return log;

      const delta = physicalQuantity - log.sapQuantity;
      const absDelta = Math.abs(delta);
      const deltaPct = log.sapQuantity > 0 ? +(delta / log.sapQuantity * 100).toFixed(1) : (physicalQuantity > 0 ? 100 : 0);

      let status: ConteoLog['status'] = 'ok';
      if (absDelta === 0) status = 'ok';
      else if (absDelta >= 25 || Math.abs(deltaPct) >= 20) status = 'critico';
      else status = 'desviacion';

      return {
        ...log,
        physicalQuantity,
        delta,
        deltaPct,
        status,
        observaciones,
      };
    });

    this.logsSubject.next(nextLogs);
  }

  getSummary(): ConteoSummary {
    const logs = this.logs;
    const completed = logs.filter((log) => log.status !== 'pendiente');
    const ok = completed.filter((log) => log.status === 'ok').length;
    const desviacion = completed.filter((log) => log.status === 'desviacion').length;
    const critico = completed.filter((log) => log.status === 'critico').length;
    const accuracyPct = completed.length ? Math.round((ok / completed.length) * 100) : 0;

    return {
      total: logs.length,
      completed: completed.length,
      pending: logs.length - completed.length,
      ok,
      desviacion,
      critico,
      accuracyPct,
    };
  }

  buildDayLoads(): ConteoDayLoad[] {
    const byDay = new Map<number, ConteoLog[]>();
    for (const log of this.logs) {
      const bucket = byDay.get(log.dia) ?? [];
      bucket.push(log);
      byDay.set(log.dia, bucket);
    }

    return Array.from(byDay.entries())
      .sort(([left], [right]) => left - right)
      .map(([dia, logs]) => {
        const turnosMap = new Map<string, ConteoLog[]>();
        let totalWeight = 0;

        for (const log of logs) {
          const material = this.materials.find((item) => item.id === log.materialId);
          totalWeight += this.difficultyWeight(material?.difficulty ?? 'media');
          const bucket = turnosMap.get(log.turno) ?? [];
          bucket.push(log);
          turnosMap.set(log.turno, bucket);
        }

        const turnos: ConteoTurnoLoad[] = Array.from(turnosMap.entries())
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([turno, turnoLogs]) => ({
            turno,
            total: turnoLogs.length,
            pending: turnoLogs.filter((log) => log.status === 'pendiente').length,
            completed: turnoLogs.filter((log) => log.status !== 'pendiente').length,
          }));

        return {
          dia,
          total: logs.length,
          pending: logs.filter((log) => log.status === 'pendiente').length,
          completed: logs.filter((log) => log.status !== 'pendiente').length,
          totalWeight,
          turnos,
        };
      });
  }

  buildDeltaBuckets(): ConteoDeltaBucket[] {
    const completed = this.logs.filter((log) => log.deltaPct != null);
    const buckets: ConteoDeltaBucket[] = [
      { label: '0%', count: 0, ratio: 0 },
      { label: '1-5%', count: 0, ratio: 0 },
      { label: '6-10%', count: 0, ratio: 0 },
      { label: '11-20%', count: 0, ratio: 0 },
      { label: '>20%', count: 0, ratio: 0 },
    ];

    for (const log of completed) {
      const pct = Math.abs(log.deltaPct ?? 0);
      if (pct === 0) buckets[0].count += 1;
      else if (pct <= 5) buckets[1].count += 1;
      else if (pct <= 10) buckets[2].count += 1;
      else if (pct <= 20) buckets[3].count += 1;
      else buckets[4].count += 1;
    }

    const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
    return buckets.map((bucket) => ({ ...bucket, ratio: bucket.count / max }));
  }

  buildLocationSummary(limit = 8): ConteoLocationSummary[] {
    const map = new Map<string, ConteoLocationSummary>();

    for (const log of this.logs) {
      const key = log.location || 'Sin localidad';
      const current = map.get(key) ?? { location: key, total: 0, pending: 0, desviacion: 0, critico: 0 };
      current.total += 1;
      if (log.status === 'pendiente') current.pending += 1;
      if (log.status === 'desviacion') current.desviacion += 1;
      if (log.status === 'critico') current.critico += 1;
      map.set(key, current);
    }

    return Array.from(map.values())
      .sort((left, right) =>
        (right.pending + right.desviacion + right.critico) - (left.pending + left.desviacion + left.critico)
        || right.total - left.total
        || left.location.localeCompare(right.location),
      )
      .slice(0, limit);
  }

  materialById(materialId: string): ConteoMaterial | undefined {
    return this.materials.find((material) => material.id === materialId);
  }

  reset(): void {
    this.materialsSubject.next([]);
    this.logsSubject.next([]);
    this.parseMetaSubject.next(null);
  }

  private parseSheetCandidate(sheet: XLSX.WorkSheet, sheetName: string): ParsedSheetCandidate | null {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '', blankrows: false });
    if (!rows.length) return null;

    const headerRow = this.detectHeaderRow(rows);
    if (headerRow == null) return null;

    const header = rows[headerRow].map((value) => String(value ?? '').trim());
    const detectedColumns = this.detectCols(header);

    if (!detectedColumns.material) return null;
    if (!(detectedColumns.cantMax || detectedColumns.descripcion || detectedColumns.ubicacion || detectedColumns.ubicacion2)) return null;

    const objectRows = rows
      .slice(headerRow + 1)
      .map((row) => this.rowToObject(header, row))
      .filter((row) => this.isLikelyDataRow(row));

    const materials: ConteoMaterial[] = [];
    let sequence = 0;
    for (const row of objectRows) {
      const material = this.rowToMaterial(row, detectedColumns, ++sequence);
      if (material) materials.push(material);
    }

    if (!materials.length) return null;

    return {
      sheetName,
      headerRow,
      detectedColumns,
      materials,
      rowCount: objectRows.length,
      score: this.scoreDetectedColumns(detectedColumns) + Math.min(materials.length, 150) / 10,
    };
  }

  private detectHeaderRow(rows: (string | number)[][]): number | null {
    let bestIndex: number | null = null;
    let bestScore = 0;

    for (let index = 0; index < Math.min(rows.length, 18); index++) {
      const score = this.scoreHeaderRow(rows[index] ?? []);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    return bestScore >= 18 ? bestIndex : null;
  }

  private scoreHeaderRow(row: (string | number)[]): number {
    const normalized = row
      .map((value) => this.norm(String(value ?? '')))
      .filter(Boolean);

    if (normalized.length < 3) return 0;

    let score = 0;
    for (const [field, aliases] of Object.entries(ConteosService.COL) as [ConteoColumn, string[]][]) {
      const aliasMatched = aliases.some((alias) => normalized.some((cell) => this.headerMatches(cell, this.norm(alias))));
      if (aliasMatched) {
        score += 4;
        if (field === 'material') score += 8;
        if (field === 'cantMax') score += 6;
        if (field === 'descripcion') score += 4;
        if (field === 'ubicacion') score += 3;
      }
    }

    return score;
  }

  private detectCols(headers: string[]): DetectedColumns {
    const normalizedHeaders = headers.map((header) => ({ original: header, normalized: this.norm(header) }));
    const columns: DetectedColumns = {};

    for (const [field, aliases] of Object.entries(ConteosService.COL) as [ConteoColumn, string[]][]) {
      const found = normalizedHeaders.find((header) =>
        aliases.some((alias) => this.headerMatches(header.normalized, this.norm(alias))),
      );
      if (found?.original) columns[field] = found.original;
    }

    return columns;
  }

  private rowToObject(header: string[], row: (string | number)[]): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    header.forEach((column, index) => {
      record[column] = row[index] ?? '';
    });
    return record;
  }

  private isLikelyDataRow(row: Record<string, unknown>): boolean {
    return Object.values(row).some((value) => String(value ?? '').trim().length > 0);
  }

  private rowToMaterial(row: Record<string, unknown>, columns: DetectedColumns, sequence: number): ConteoMaterial | null {
    const material = columns.material ? String(row[columns.material] ?? '').trim().toUpperCase() : '';
    if (!material) return null;

    const str = (field: ConteoColumn) => columns[field] ? String(row[columns[field]!] ?? '').trim() : '';
    const num = (field: ConteoColumn) => columns[field] ? this.toNum(row[columns[field]!]) : 0;
    const bool = (field: ConteoColumn) => ['X', 'TRUE', 'YES', 'SI', '1'].includes(str(field).toUpperCase());

    const description = str('descripcion');
    const quantity = num('cantMax');
    const bulk = bool('bulk');
    const presentation = str('presentacion');
    const difficulty = this.calcDifficulty(description, bulk, quantity, presentation);

    const materialRow: ConteoMaterial = {
      id: `CTM-${String(sequence).padStart(4, '0')}`,
      material,
      descripcion: description,
      location: str('ubicacion'),
      location2: str('ubicacion2'),
      sapQuantity: quantity,
      precio: num('precio'),
      tipo: str('tipo'),
      bulk,
      familia: str('familia'),
      cantMin: num('cantMin'),
      cantMax: quantity,
      nivelProceso: str('nivelProceso'),
      presentacion: presentation,
      difficulty: difficulty.level,
      difficultyScore: difficulty.score,
      priorityScore: 0,
    };

    materialRow.priorityScore = this.calcPriority(materialRow);
    return materialRow;
  }

  private mergeMaterials(materials: ConteoMaterial[]): ConteoMaterial[] {
    const merged = new Map<string, ConteoMaterial>();

    for (const material of materials) {
      const key = [
        material.material,
        this.normData(material.location),
        this.normData(material.location2),
      ].join('|');

      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...material });
        continue;
      }

      existing.descripcion = existing.descripcion || material.descripcion;
      existing.location = existing.location || material.location;
      existing.location2 = existing.location2 || material.location2;
      existing.precio = Math.max(existing.precio, material.precio);
      existing.tipo = existing.tipo || material.tipo;
      existing.bulk = existing.bulk || material.bulk;
      existing.familia = existing.familia || material.familia;
      existing.cantMin += material.cantMin;
      existing.cantMax += material.cantMax;
      existing.sapQuantity += material.sapQuantity;
      existing.nivelProceso = existing.nivelProceso || material.nivelProceso;
      existing.presentacion = existing.presentacion || material.presentacion;
    }

    return Array.from(merged.values())
      .map((material, index) => {
        const difficulty = this.calcDifficulty(material.descripcion, material.bulk, material.sapQuantity, material.presentacion);
        const consolidated: ConteoMaterial = {
          ...material,
          id: `CTM-${String(index + 1).padStart(4, '0')}`,
          difficulty: difficulty.level,
          difficultyScore: difficulty.score,
          priorityScore: 0,
        };
        consolidated.priorityScore = this.calcPriority(consolidated);
        return consolidated;
      })
      .sort((left, right) => right.priorityScore - left.priorityScore || left.material.localeCompare(right.material));
  }

  private calcDifficulty(description: string, bulk: boolean, quantity: number, presentation: string): { score: number; level: DifficultyLevel } {
    let score = 50;
    const normalizedDescription = this.norm(description);

    if (ConteosService.EASY.some((keyword) => normalizedDescription.includes(this.norm(keyword)))) score -= 24;
    if (ConteosService.MED.some((keyword) => normalizedDescription.includes(this.norm(keyword)))) score += 6;
    if (ConteosService.HARD.some((keyword) => normalizedDescription.includes(this.norm(keyword)))) score += 24;

    if (bulk) score += 14;
    if (quantity > 1000) score += 8;
    if (quantity > 5000) score += 8;

    const normalizedPresentation = this.norm(presentation);
    if (normalizedPresentation === 'BIN' || normalizedPresentation === 'BOX') score -= 8;
    if (normalizedPresentation === 'MAMPARA') score += 6;
    if (description.length > 60) score += 4;

    score = Math.max(10, Math.min(95, score));
    const level: DifficultyLevel = score < 38 ? 'baja' : score < 62 ? 'media' : 'alta';
    return { score, level };
  }

  private calcPriority(material: ConteoMaterial): number {
    let score = 0;
    const inventoryValue = material.precio * material.sapQuantity;

    if (inventoryValue > 10000) score += 30;
    else if (inventoryValue > 5000) score += 22;
    else if (inventoryValue > 1000) score += 15;
    else if (inventoryValue > 100) score += 10;
    else score += 4;

    if (material.precio > 100) score += 18;
    else if (material.precio > 10) score += 12;
    else if (material.precio > 1) score += 6;

    if (material.sapQuantity > 5000) score += 12;
    else if (material.sapQuantity > 1000) score += 8;
    else if (material.sapQuantity > 500) score += 5;

    score += material.difficultyScore * 0.12;
    if (material.bulk) score += 8;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private difficultyWeight(level: DifficultyLevel): number {
    if (level === 'alta') return 3;
    if (level === 'media') return 2;
    return 1;
  }

  private scoreDetectedColumns(columns: DetectedColumns): number {
    let score = 0;
    if (columns.material) score += 10;
    if (columns.cantMax) score += 8;
    if (columns.descripcion) score += 6;
    if (columns.ubicacion) score += 6;
    if (columns.precio) score += 3;
    if (columns.bulk) score += 2;
    return score;
  }

  private norm(value: string): string {
    return (value ?? '')
      .toString()
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_().-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normData(value: string): string {
    return this.norm(value);
  }

  private headerMatches(header: string, alias: string): boolean {
    if (!header || !alias) return false;
    if (header === alias) return true;
    if (alias.length >= 4 && header.includes(alias)) return true;
    return false;
  }

  private toNum(value: unknown): number {
    if (typeof value === 'number') return value;
    const normalized = String(value ?? '')
      .replace(/[$,\s]/g, '')
      .replace(/\((.+)\)/, '-$1');
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private planDate(dia: number): string {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + (dia - 1));
    return base.toISOString().slice(0, 10);
  }
}
