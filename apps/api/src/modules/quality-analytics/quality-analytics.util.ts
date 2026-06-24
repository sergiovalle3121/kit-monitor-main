// ─────────────────────────────────────────────────────────────────────────────
// Matemática PURA del tablero analítico de calidad. Sin dependencias de NestJS ni
// de la base: recibe filas planas y devuelve métricas. Aislado así para poder
// probarlo de verdad (Pareto, PPM, FPY, estado de CAPAs) sin levantar la app.
// El QualityAnalyticsService solo HIDRATA estas funciones con datos de los repos.
// ─────────────────────────────────────────────────────────────────────────────

export interface NcrLike {
  id: number;
  defectCodeId?: number | null;
  model?: string | null;
  line?: string | null;
  severity?: string;
  status?: string;
  quantityAffected?: number;
  createdAt: Date | string;
}

export interface DefectCodeLike {
  id: number;
  code: string;
  description: string;
  category: string;
}

export interface IqcLike {
  sampleSize?: number | null;
  defectsFound?: number | null;
  result?: string;
  supplier?: { id: number | string; name?: string } | null;
  createdAt: Date | string;
}

export interface TestRecordLike {
  serialNumber: string;
  result: string; // PASS | FAIL
  model?: string | null;
  station?: string | null;
  testedAt?: Date | string | null;
  failureCode?: string | null;
}

export interface CapaLike {
  capaNumber: string;
  partNumber: string;
  status: string;
  dueDate?: Date | string | null;
  closedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface FinalInspectionLike {
  quantityInspected?: number;
  quantityPassed?: number;
  quantityFailed?: number;
  createdAt: Date | string;
}

export interface DispositionLike {
  type: string;
  quantity?: number;
  createdAt: Date | string;
}

// ── helpers ─────────────────────────────────────────────────────────────────
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function time(v: Date | string | null | undefined): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}
export function monthKey(v: Date | string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Pareto (orden desc + % y % acumulado) ────────────────────────────────────
export interface ParetoRow {
  key: string;
  label: string;
  count: number;
  pct: number;
  cumPct: number;
}

/**
 * Pareto canónico: descarta ceros, ordena por frecuencia descendente (desempate
 * estable por etiqueta) y acumula el porcentaje hasta 100 en la última barra.
 */
export function toPareto(
  items: { key: string; label: string; count: number }[],
): ParetoRow[] {
  const sorted = items
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const total = sorted.reduce((s, i) => s + i.count, 0);
  let cum = 0;
  return sorted.map((i) => {
    cum += i.count;
    return {
      key: i.key,
      label: i.label,
      count: i.count,
      pct: total ? round1((i.count / total) * 100) : 0,
      cumPct: total ? round1((cum / total) * 100) : 0,
    };
  });
}

export interface DefectParetoRow extends ParetoRow {
  defectCodeId: number | null;
  category?: string;
  description?: string;
}

/**
 * Pareto de defectos basado en el código tipificado. Las NCR sin código se
 * agrupan como «Sin clasificar» (key 'unclassified') para INVITAR a clasificar.
 */
export function buildDefectPareto(
  ncrs: NcrLike[],
  codeById: Map<number, DefectCodeLike>,
): DefectParetoRow[] {
  const counts = new Map<string, number>();
  for (const n of ncrs) {
    const id = n.defectCodeId ?? null;
    const k = id == null ? 'unclassified' : String(id);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const base = [...counts.entries()].map(([k, count]) => {
    const id = k === 'unclassified' ? null : Number(k);
    const code = id != null ? codeById.get(id) : undefined;
    return {
      key: k,
      label: id == null ? 'Sin clasificar' : code ? code.code : `#${id}`,
      count,
    };
  });
  return toPareto(base).map((p) => {
    const id = p.key === 'unclassified' ? null : Number(p.key);
    const code = id != null ? codeById.get(id) : undefined;
    return {
      ...p,
      defectCodeId: id,
      category: code?.category,
      description: code?.description,
    };
  });
}

// ── PPM de proveedor (desde iqc_inspections) ─────────────────────────────────
export interface SupplierPpm {
  supplierId: number | string | null;
  supplierName: string;
  inspections: number;
  inspected: number; // piezas inspeccionadas (Σ sampleSize)
  defects: number; // Σ defectsFound
  ppm: number | null; // defects / inspected * 1e6
}

/**
 * PPM por proveedor: Σ(rechazos) / Σ(inspeccionado) × 1e6. Es la fuente honesta
 * del PPM de proveedor en una planta EMS (cae directo de la inspección de recibo).
 */
export function computeSupplierPpm(iqc: IqcLike[]): SupplierPpm[] {
  const m = new Map<string, SupplierPpm>();
  for (const r of iqc) {
    const id = r.supplier?.id ?? null;
    const key = id == null ? 'none' : String(id);
    const cur = m.get(key) ?? {
      supplierId: id,
      supplierName: r.supplier?.name ?? 'Sin proveedor',
      inspections: 0,
      inspected: 0,
      defects: 0,
      ppm: null,
    };
    cur.inspections += 1;
    cur.inspected += num(r.sampleSize);
    cur.defects += num(r.defectsFound);
    m.set(key, cur);
  }
  return [...m.values()]
    .map((s) => ({
      ...s,
      ppm:
        s.inspected > 0
          ? Math.round((s.defects / s.inspected) * 1_000_000)
          : null,
    }))
    .sort((a, b) => (b.ppm ?? -1) - (a.ppm ?? -1));
}

export interface PpmPoint {
  period: string; // YYYY-MM
  inspected: number;
  defects: number;
  ppm: number | null;
}

/** Tendencia mensual de PPM agregando todos los proveedores. */
export function computeIqcPpmTrend(iqc: IqcLike[]): PpmPoint[] {
  const m = new Map<string, { inspected: number; defects: number }>();
  for (const r of iqc) {
    const k = monthKey(r.createdAt);
    if (!k) continue;
    const cur = m.get(k) ?? { inspected: 0, defects: 0 };
    cur.inspected += num(r.sampleSize);
    cur.defects += num(r.defectsFound);
    m.set(k, cur);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({
      period,
      inspected: v.inspected,
      defects: v.defects,
      ppm:
        v.inspected > 0
          ? Math.round((v.defects / v.inspected) * 1_000_000)
          : null,
    }));
}

/**
 * PPM defectivo de PROCESO desde los registros de prueba: fallas / pruebas × 1e6.
 * OJO: es PPM defectivo (unidades defectuosas por millón), NO un DPMO clásico —
 * el DPMO exige «oportunidades por unidad», dato que el sistema no captura aún
 * (queda como follow-up). Documentado para no inflar el número.
 */
export function computeProcessPpmTrend(records: TestRecordLike[]): PpmPoint[] {
  const m = new Map<string, { units: number; defects: number }>();
  for (const r of records) {
    const k = monthKey(r.testedAt ?? '');
    if (!k) continue;
    const cur = m.get(k) ?? { units: 0, defects: 0 };
    cur.units += 1;
    if (String(r.result).toUpperCase() === 'FAIL') cur.defects += 1;
    m.set(k, cur);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({
      period,
      inspected: v.units,
      defects: v.defects,
      ppm: v.units > 0 ? Math.round((v.defects / v.units) * 1_000_000) : null,
    }));
}

// ── First Pass Yield ──────────────────────────────────────────────────────────
export interface FpyGroup {
  key: string;
  serials: number;
  firstPass: number;
  fpy: number | null; // %
}

/**
 * FPY por grupo (modelo o estación): por cada serie toma su PRIMERA prueba; el
 * yield es series con primera-prueba PASS / series distintas. Reusa la misma
 * definición que el módulo de testing para mantener coherencia.
 */
export function computeFpyByGroup(
  records: TestRecordLike[],
  keyOf: (r: TestRecordLike) => string,
): FpyGroup[] {
  const groups = new Map<string, Map<string, TestRecordLike>>();
  for (const r of records) {
    const gk = (keyOf(r) || '—').trim() || '—';
    const firstBySerial = groups.get(gk) ?? new Map<string, TestRecordLike>();
    const prev = firstBySerial.get(r.serialNumber);
    if (!prev || time(r.testedAt) < time(prev.testedAt)) {
      firstBySerial.set(r.serialNumber, r);
    }
    groups.set(gk, firstBySerial);
  }
  return [...groups.entries()]
    .map(([key, firstBySerial]) => {
      const serials = firstBySerial.size;
      const firstPass = [...firstBySerial.values()].filter(
        (t) => String(t.result).toUpperCase() === 'PASS',
      ).length;
      return {
        key,
        serials,
        firstPass,
        fpy: serials > 0 ? round1((firstPass / serials) * 100) : null,
      };
    })
    .sort((a, b) => b.serials - a.serials);
}

// ── Cortes simples (conteo por dimensión) ────────────────────────────────────
export interface CountRow {
  key: string;
  label: string;
  count: number;
}

export function countBy(
  ncrs: NcrLike[],
  get: (n: NcrLike) => string | null | undefined,
  fallback: string,
): CountRow[] {
  const m = new Map<string, number>();
  for (const n of ncrs) {
    const k = (get(n) || '').trim() || fallback;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Estado de CAPAs ───────────────────────────────────────────────────────────
export interface CapaOverdue {
  capaNumber: string;
  partNumber: string;
  status: string;
  dueDate: string | null;
  daysOverdue: number;
}

export interface CapaStats {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  avgCloseDays: number | null;
  byStatus: { status: string; count: number }[];
  overdueList: CapaOverdue[];
}

const DAY = 86_400_000;

/**
 * Estado de las CAPAs: abiertas / cerradas / vencidas, tiempo promedio de cierre
 * y la lista de vencidas (vencida = no cerrada y con dueDate ya pasada). El tiempo
 * de cierre usa closedAt cuando existe; si una CAPA cerrada no lo tiene, cae a
 * updatedAt (documentado).
 */
export function computeCapaStats(
  capas: CapaLike[],
  now: Date = new Date(),
): CapaStats {
  const nowT = now.getTime();
  let open = 0;
  let closed = 0;
  let overdue = 0;
  const byStatus = new Map<string, number>();
  const closeDurations: number[] = [];
  const overdueList: CapaOverdue[] = [];

  for (const c of capas) {
    const isClosed = c.status === 'closed';
    byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
    if (isClosed) {
      closed++;
      const end = time(c.closedAt) || time(c.updatedAt);
      const start = time(c.createdAt);
      if (end && start && end >= start)
        closeDurations.push((end - start) / DAY);
    } else {
      open++;
      const due = time(c.dueDate);
      if (due && due < nowT) {
        overdue++;
        overdueList.push({
          capaNumber: c.capaNumber,
          partNumber: c.partNumber,
          status: c.status,
          dueDate: c.dueDate ? new Date(c.dueDate).toISOString() : null,
          daysOverdue: Math.floor((nowT - due) / DAY),
        });
      }
    }
  }

  overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);
  const avgCloseDays =
    closeDurations.length > 0
      ? round1(
          closeDurations.reduce((s, d) => s + d, 0) / closeDurations.length,
        )
      : null;

  return {
    total: capas.length,
    open,
    closed,
    overdue,
    avgCloseDays,
    byStatus: [...byStatus.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    overdueList,
  };
}

// ── OQC yield (desde final_inspections) ──────────────────────────────────────
export interface OqcYield {
  inspected: number;
  passed: number;
  failed: number;
  yieldPct: number | null;
}

export function computeOqcYield(rows: FinalInspectionLike[]): OqcYield {
  let inspected = 0;
  let passed = 0;
  let failed = 0;
  for (const r of rows) {
    inspected += num(r.quantityInspected);
    passed += num(r.quantityPassed);
    failed += num(r.quantityFailed);
  }
  return {
    inspected,
    passed,
    failed,
    yieldPct: inspected > 0 ? round1((passed / inspected) * 100) : null,
  };
}

// ── Disposiciones (MRB) en UNIDADES — base real para una futura COPQ ─────────
export interface DispositionUnits {
  type: string;
  count: number;
  units: number;
}

export function computeDispositionUnits(
  rows: DispositionLike[],
): DispositionUnits[] {
  const m = new Map<string, { count: number; units: number }>();
  for (const r of rows) {
    const cur = m.get(r.type) ?? { count: 0, units: 0 };
    cur.count += 1;
    cur.units += num(r.quantity);
    m.set(r.type, cur);
  }
  return [...m.entries()]
    .map(([type, v]) => ({ type, count: v.count, units: v.units }))
    .sort((a, b) => b.units - a.units);
}
