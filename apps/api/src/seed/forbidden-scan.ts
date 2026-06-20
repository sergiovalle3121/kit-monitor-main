/**
 * AXOS OS — Escáner de datos PROHIBIDOS en la base (motor compartido).
 *
 * Recorre TODAS las entidades registradas (metadata de TypeORM) y revisa cada
 * columna de texto / arreglo / JSON con el detector legal que YA EXISTE en el
 * guard (`findForbiddenReason`). NO inventa su propia lista: usa
 * `FORBIDDEN_PREFIXES` y `REAL_COMPANY_BLACKLIST` a través del guard.
 *
 * Al ser metadata-driven cubre por construcción cada tabla con campos de
 * parte / modelo / cliente / programa / proveedor (materials, requisiciones,
 * POs, BOMs, models, shipments, inventario, RMA, CRM, genealogía, sf_*, ERP…)
 * sin tener que enumerar a mano las columnas.
 *
 * Lo usan:
 *   • seed-audit-forbidden.ts → reporte DRY-RUN por tabla (Fase 1, paso 1).
 *   • seed-purge-clients.ts   → purga FK-safe detrás de --apply (Fase 1, paso 2).
 *   • public-domain-guard     → aserción ruidosa de arranque/seed (Fase 1, paso 3).
 */
import type { DataSource, EntityMetadata, ObjectLiteral } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';

import { findForbiddenReason } from './public-domain-guard';

export type HitKind = 'text' | 'array' | 'json';

export interface ForbiddenHit {
  field: string; // propiedad de la entidad
  column: string; // columna real en la BD
  kind: HitKind;
  value: string; // valor ofensivo (recortado para el reporte)
  reason: string; // motivo devuelto por el guard
}

export interface ForbiddenRow {
  pk: string; // PK serializada (legible; para reporte y borrado)
  hits: ForbiddenHit[];
  entity: ObjectLiteral; // la entidad cargada (la purga la usa con repo.remove)
}

export interface EntityFindings {
  table: string; // nombre de tabla en la BD
  entity: string; // nombre de la entidad (clase/metadata)
  target: unknown; // metadata.target (para ds.getRepository en la purga)
  scanned: number; // filas revisadas
  matched: number; // filas con ≥1 hit
  fields: string[]; // columnas de texto/array/json revisadas (transparencia)
  rows: ForbiddenRow[]; // SÓLO filas con hits (subconjunto pequeño)
}

export interface ScanError {
  table: string;
  entity: string;
  error: string;
}

export interface ScanSkip {
  table: string;
  entity: string;
  reason: string;
}

export interface ScanResult {
  findings: EntityFindings[]; // todas las entidades revisadas
  withHits: EntityFindings[]; // sólo las que tienen ≥1 fila prohibida
  totalEntities: number;
  totalScannedRows: number;
  totalMatchedRows: number;
  byReason: Record<string, number>; // motivo → # de hits
  errors: ScanError[];
  skipped: ScanSkip[];
}

export interface ScanOptions {
  /**
   * Columnas que NO se revisan (ruido fuera del alcance "parte/modelo/cliente/
   * programa": chat libre, payloads de auditoría). Mapea tabla → [propiedad].
   * Se fusiona con `DEFAULT_SKIP_COLUMNS`.
   */
  skipColumns?: Record<string, string[]>;
  /** Revisar columnas JSON/jsonb/simple-json (serializadas). Default: true. */
  scanJson?: boolean;
  /** Tope de filas a cargar por tabla (0 = sin límite). Default: 0. */
  maxRowsPerTable?: number;
  /** Logger opcional para progreso. */
  log?: (msg: string) => void;
}

/**
 * Texto libre de comunicación / auditoría: fuera del alcance del barrido legal de
 * datos de negocio (genera ruido). Se puede revisar aparte si se desea. El owner
 * puede ajustar esto al correr el audit.
 */
export const DEFAULT_SKIP_COLUMNS: Record<string, string[]> = {
  messages: ['content'],
  conversations: ['name'],
  audit_logs: ['before', 'after', 'metadata', 'oldValues', 'newValues', 'payload'],
  office_documents: ['content', 'data'],
  office_document_versions: ['content', 'data'],
};

const TEXT_DB_TYPES = new Set([
  'varchar',
  'character varying',
  'text',
  'char',
  'character',
  'citext',
  'nvarchar',
  'nchar',
  'tinytext',
  'mediumtext',
  'longtext',
  'string',
]);

const JSON_DB_TYPES = new Set(['json', 'jsonb', 'simple-json']);

/** Clasifica una columna por su tipo: texto, arreglo de strings, JSON, o null. */
function classifyColumn(col: ColumnMetadata): HitKind | null {
  const t = col.type as unknown;
  if (t === String) return 'text';
  const name = (typeof t === 'string' ? t : ((t as { name?: string })?.name ?? '')).toLowerCase();
  if (TEXT_DB_TYPES.has(name)) return 'text';
  if (name === 'simple-array') return 'array';
  if (JSON_DB_TYPES.has(name)) return 'json';
  return null;
}

/** Recorta valores largos para que el reporte sea legible. */
function short(value: string, n = 100): string {
  const v = value.replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n)}…` : v;
}

/** Serializa la PK de una fila de forma legible (soporta PK compuesta o string). */
function serializePk(meta: EntityMetadata, row: ObjectLiteral): string {
  const cols = meta.primaryColumns;
  if (!cols.length) return '(sin PK)';
  return cols
    .map((c) => `${c.propertyName}=${String(row[c.propertyName] ?? '∅')}`)
    .join(', ');
}

/** Revisa una sola fila contra las columnas de texto/array/json indicadas. */
function inspectRow(
  row: ObjectLiteral,
  columns: Array<{ col: ColumnMetadata; kind: HitKind }>,
): ForbiddenHit[] {
  const hits: ForbiddenHit[] = [];
  for (const { col, kind } of columns) {
    const raw = row[col.propertyName];
    if (raw === null || raw === undefined) continue;

    if (kind === 'text') {
      const reason = findForbiddenReason(typeof raw === 'string' ? raw : String(raw));
      if (reason) {
        hits.push({ field: col.propertyName, column: col.databaseName, kind, value: short(String(raw)), reason });
      }
    } else if (kind === 'array') {
      const arr = Array.isArray(raw) ? raw : String(raw).split(',');
      for (const el of arr) {
        const reason = findForbiddenReason(String(el));
        if (reason) {
          hits.push({ field: col.propertyName, column: col.databaseName, kind, value: short(String(el)), reason });
          break; // un hit por columna basta para marcar la fila
        }
      }
    } else {
      // json / jsonb / simple-json → serializar y revisar el texto completo.
      let text: string;
      try {
        text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      } catch {
        continue;
      }
      const reason = findForbiddenReason(text);
      if (reason) {
        hits.push({ field: col.propertyName, column: col.databaseName, kind, value: short(text, 140), reason });
      }
    }
  }
  return hits;
}

/**
 * Recorre TODA la base y devuelve, por entidad, las filas cuyos campos de texto/
 * array/json NO son de dominio público (prefijo prohibido o empresa real). Es
 * SÓLO LECTURA: jamás borra ni modifica. La purga reutiliza `rows[].entity`.
 */
export async function scanForbidden(
  ds: DataSource,
  opts: ScanOptions = {},
): Promise<ScanResult> {
  const scanJson = opts.scanJson !== false;
  const maxRows = opts.maxRowsPerTable ?? 0;
  const log = opts.log ?? (() => undefined);
  const skip: Record<string, string[]> = { ...DEFAULT_SKIP_COLUMNS, ...(opts.skipColumns ?? {}) };

  const findings: EntityFindings[] = [];
  const errors: ScanError[] = [];
  const skipped: ScanSkip[] = [];
  const byReason: Record<string, number> = {};
  let totalScannedRows = 0;
  let totalMatchedRows = 0;

  for (const meta of ds.entityMetadatas) {
    // Sólo tablas reales (no vistas, junctions ni cierres de jerarquía).
    if (meta.tableType !== 'regular' && meta.tableType !== 'entity-child') {
      continue;
    }
    if (typeof meta.target !== 'function') {
      skipped.push({ table: meta.tableName, entity: meta.name, reason: 'sin clase target (no consultable)' });
      continue;
    }

    const skipProps = new Set(skip[meta.tableName] ?? []);
    const columns: Array<{ col: ColumnMetadata; kind: HitKind }> = [];
    for (const col of meta.columns) {
      if (skipProps.has(col.propertyName) || skipProps.has(col.databaseName)) continue;
      const kind = classifyColumn(col);
      if (!kind) continue;
      if (kind === 'json' && !scanJson) continue;
      columns.push({ col, kind });
    }

    if (!columns.length) {
      skipped.push({ table: meta.tableName, entity: meta.name, reason: 'sin columnas de texto/array/json' });
      continue;
    }

    try {
      const repo = ds.getRepository(meta.target);
      const rows: ObjectLiteral[] = maxRows > 0 ? await repo.find({ take: maxRows }) : await repo.find();
      const matchedRows: ForbiddenRow[] = [];

      for (const row of rows) {
        const hits = inspectRow(row, columns);
        if (hits.length) {
          matchedRows.push({ pk: serializePk(meta, row), hits, entity: row });
          for (const h of hits) byReason[h.reason] = (byReason[h.reason] ?? 0) + 1;
        }
      }

      totalScannedRows += rows.length;
      totalMatchedRows += matchedRows.length;
      findings.push({
        table: meta.tableName,
        entity: meta.name,
        target: meta.target,
        scanned: rows.length,
        matched: matchedRows.length,
        fields: columns.map((c) => c.col.propertyName),
        rows: matchedRows,
      });
      if (matchedRows.length) {
        log(`  ⚠ ${meta.tableName}: ${matchedRows.length}/${rows.length} fila(s) prohibida(s)`);
      }
    } catch (err) {
      errors.push({ table: meta.tableName, entity: meta.name, error: (err as Error).message });
      log(`  ✖ ${meta.tableName}: ${(err as Error).message}`);
    }
  }

  const withHits = findings.filter((f) => f.matched > 0).sort((a, b) => b.matched - a.matched);

  return {
    findings,
    withHits,
    totalEntities: findings.length,
    totalScannedRows,
    totalMatchedRows,
    byReason,
    errors,
    skipped,
  };
}

/**
 * Formatea el resultado del barrido como un reporte por tabla legible en consola
 * (conteos + ejemplos). Compartido por el audit y por el dry-run de la purga.
 */
export function formatScanReport(res: ScanResult, opts: { examplesPerTable?: number } = {}): string {
  const ex = opts.examplesPerTable ?? 3;
  const out: string[] = [];

  if (!res.withHits.length) {
    out.push('✅ Sin datos prohibidos: la base está limpia (0 prefijos OP-/empresas reales).');
  } else {
    out.push(`Tablas con datos prohibidos: ${res.withHits.length}   ·   Filas afectadas: ${res.totalMatchedRows}`);
    out.push('─'.repeat(72));
    for (const f of res.withHits) {
      out.push(`▶ ${f.table}  (${f.entity})  —  ${f.matched} fila(s) de ${f.scanned}`);
      for (const r of f.rows.slice(0, ex)) {
        const h = r.hits[0];
        const extra = r.hits.length > 1 ? ` (+${r.hits.length - 1} campo más)` : '';
        out.push(`    · [${r.pk}]  ${h.field}="${h.value}" → ${h.reason}${extra}`);
      }
      if (f.matched > ex) out.push(`    … y ${f.matched - ex} fila(s) más`);
    }
    out.push('─'.repeat(72));
    out.push('Desglose por motivo:');
    for (const [reason, count] of Object.entries(res.byReason).sort((a, b) => b[1] - a[1])) {
      out.push(`    ${count.toString().padStart(5)} × ${reason}`);
    }
  }

  out.push('─'.repeat(72));
  out.push(
    `Resumen: ${res.totalEntities} tablas revisadas · ${res.totalScannedRows} filas leídas · ` +
      `${res.totalMatchedRows} prohibidas · ${res.errors.length} errores de lectura · ${res.skipped.length} tablas sin texto.`,
  );
  if (res.errors.length) {
    out.push('Errores de lectura (revisar manualmente):');
    for (const e of res.errors.slice(0, 20)) out.push(`    ✖ ${e.table}: ${e.error}`);
  }
  return out.join('\n');
}

/**
 * Aserción ruidosa: LANZA si la base contiene cualquier dato prohibido. La usan
 * el seed (tras sembrar) y el chequeo opcional de arranque para que datos de
 * cliente real NUNCA se cuelen / se queden sin detectar.
 */
export async function assertDatabasePublicDomain(
  ds: DataSource,
  opts: ScanOptions = {},
): Promise<ScanResult> {
  const res = await scanForbidden(ds, opts);
  if (res.totalMatchedRows > 0) {
    const sample = res.withHits
      .slice(0, 15)
      .map((f) => {
        const h = f.rows[0]?.hits[0];
        return `   • ${f.table}: ${f.matched} fila(s) — p. ej. ${h?.field}="${h?.value}" (${h?.reason})`;
      })
      .join('\n');
    throw new Error(
      `🚫 DATOS PROHIBIDOS EN LA BASE: ${res.totalMatchedRows} fila(s) en ${res.withHits.length} tabla(s) ` +
        `con prefijo de cliente (p. ej. OP-) o nombre de empresa real.\n${sample}\n` +
        `Corre el audit (seed:audit-forbidden) y la purga (seed:purge-clients --apply) para limpiarlo. ` +
        `La app SÓLO puede contener datos ficticios del universo AXOS.`,
    );
  }
  return res;
}
