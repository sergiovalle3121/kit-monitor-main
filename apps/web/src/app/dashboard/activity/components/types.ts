/**
 * Tipos y metadatos del visor del Event Ledger (la bitácora inmutable).
 *
 * Espeja la entidad de backend `LedgerEvent`
 * (apps/api/src/modules/event-ledger/entities/ledger-event.entity.ts) para que la
 * UI hable exactamente el mismo idioma que la fuente de verdad. No reescribir
 * estos campos sin alinear con la entidad: la bitácora es auditable, así que la
 * forma de los datos importa tanto como los datos.
 */
import {
  Boxes,
  LineChart,
  Factory,
  Cpu,
  ShieldCheck,
  Truck,
  Cog,
  Activity,
  type LucideIcon,
} from 'lucide-react';

/** Dominios del ledger — debe coincidir con el enum EventDomain del backend. */
export type EventDomain =
  | 'MATERIALS'
  | 'PLANNING'
  | 'PRODUCTION'
  | 'ENGINEERING'
  | 'QUALITY'
  | 'SHIPPING'
  | 'SYSTEM';

/** Un evento inmutable de la bitácora, tal como lo devuelve el backend. */
export interface LedgerEvent {
  id: string;
  tenantId?: string | null;
  timestamp: string; // ISO
  actorId?: string | null;
  actorName?: string | null;
  domain: EventDomain | string;
  action: string; // p.ej. 'KIT_CREATED', 'STATUS_CHANGED'
  referenceType?: string | null; // p.ej. 'WORK_ORDER', 'NCR', 'KIT'
  referenceId?: string | null;

  // Contexto organizacional e industrial (columnas indexadas en backend).
  plant?: string | null;
  warehouse?: string | null;
  line?: string | null;
  shift?: string | null;
  customer?: string | null;
  program?: string | null;
  model?: string | null;
  workOrder?: string | null;

  context?: {
    revision?: string;
    lot?: string;
    serial?: string;
    [key: string]: unknown;
  } | null;
  transaction?: {
    quantity?: number;
    fromLocation?: string;
    toLocation?: string;
    unit?: string;
    [key: string]: unknown;
  } | null;
  metadata?: {
    reasonCode?: string;
    reasonDesc?: string;
    approvalContext?: unknown;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    durationMs?: number;
    httpMethod?: string;
    path?: string;
    [key: string]: unknown;
  } | null;
}

export interface DomainMeta {
  label: string;
  color: string;
  icon: LucideIcon;
}

/**
 * Color + símbolo por dominio. Reusa la paleta del sistema de diseño donde el
 * dominio del ledger tiene equivalente; SHIPPING y SYSTEM no existen como
 * DomainKey, así que se definen aquí (este módulo es autocontenido y no edita
 * el sistema de diseño global — disciplina de carril).
 */
export const EVENT_DOMAIN_META: Record<EventDomain, DomainMeta> = {
  MATERIALS:   { label: 'Materiales',  color: '#16a394', icon: Boxes },
  PLANNING:    { label: 'Planeación',  color: '#5b5bd6', icon: LineChart },
  PRODUCTION:  { label: 'Producción',  color: '#ff7a45', icon: Factory },
  ENGINEERING: { label: 'Ingeniería',  color: '#5b63e0', icon: Cpu },
  QUALITY:     { label: 'Calidad',     color: '#2ec27e', icon: ShieldCheck },
  SHIPPING:    { label: 'Embarques',   color: '#0a84ff', icon: Truck },
  SYSTEM:      { label: 'Sistema',     color: '#6b7280', icon: Cog },
};

const FALLBACK_META: DomainMeta = { label: 'Otro', color: '#6b7280', icon: Activity };

export function domainMeta(domain: EventDomain | string | null | undefined): DomainMeta {
  if (domain && domain in EVENT_DOMAIN_META) {
    return EVENT_DOMAIN_META[domain as EventDomain];
  }
  return FALLBACK_META;
}

/** Lista ordenada de dominios para los chips de filtro. */
export const DOMAIN_ORDER: EventDomain[] = [
  'MATERIALS',
  'PLANNING',
  'PRODUCTION',
  'ENGINEERING',
  'QUALITY',
  'SHIPPING',
  'SYSTEM',
];

/** Verbos del interceptor de backend → etiqueta legible en español. */
const VERB_ES: Record<string, string> = {
  CREATED: 'creado',
  UPDATED: 'actualizado',
  DELETED: 'eliminado',
  MUTATED: 'modificado',
  CHANGED: 'cambiado',
  DETECTED: 'detectado',
  APPROVED: 'aprobado',
  REJECTED: 'rechazado',
  CLOSED: 'cerrado',
  OPENED: 'abierto',
};

/**
 * Humaniza un código de acción (`KIT_CREATED` → "Kit creado") sin perder el
 * código crudo, que se sigue mostrando como insignia mono para auditoría.
 */
export function humanizeAction(action: string | null | undefined): string {
  if (!action) return 'Evento';
  const parts = action.split('_');
  const last = parts[parts.length - 1];
  const verb = VERB_ES[last];
  const entity = (verb ? parts.slice(0, -1) : parts)
    .join(' ')
    .toLowerCase()
    .trim();
  const entityCap = entity ? entity.charAt(0).toUpperCase() + entity.slice(1) : 'Registro';
  return verb ? `${entityCap} ${verb}` : entityCap || action;
}

const RELATIVE_DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' }) : null;

/** "hace 5 min", "ayer", etc. Tolerante a fechas inválidas. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  let duration = (then - Date.now()) / 1000;
  if (!rtf) return '';
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return '';
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? '';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Etiqueta del encabezado de día: "Hoy", "Ayer" o fecha larga. */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Clave de día (YYYY-MM-DD en hora local) para agrupar el timeline. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Recorta un valor a texto corto para insignias / celdas de diff. */
export function shortValue(v: unknown, max = 80): string {
  if (v === null || v === undefined) return '∅';
  let s: string;
  if (typeof v === 'string') s = v;
  else if (typeof v === 'number' || typeof v === 'boolean') s = String(v);
  else {
    try {
      s = JSON.stringify(v);
    } catch {
      s = String(v);
    }
  }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface FieldDiff {
  key: string;
  before: unknown;
  after: unknown;
}

/**
 * Diferencia de primer nivel entre dos estados (before/after). Devuelve solo las
 * claves cuyo valor cambió, listas para una tabla compacta "antes → después".
 */
export function diffStates(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): FieldDiff[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: FieldDiff[] = [];
  for (const key of keys) {
    const b = (before as Record<string, unknown>)[key];
    const a = (after as Record<string, unknown>)[key];
    let same: boolean;
    try {
      same = JSON.stringify(b) === JSON.stringify(a);
    } catch {
      same = b === a;
    }
    if (!same) diffs.push({ key, before: b, after: a });
  }
  return diffs;
}

/**
 * Pares (etiqueta, valor) de contexto industrial presentes en un evento, para
 * pintarlos como insignias. Solo incluye lo que existe — nada de relleno.
 */
export function contextChips(e: LedgerEvent): Array<{ label: string; value: string }> {
  const chips: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: unknown) => {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      chips.push({ label, value: String(value) });
    }
  };
  push('WO', e.workOrder ?? e.context?.workOrder);
  push('Serial', e.context?.serial);
  push('Lote', e.context?.lot);
  push('Modelo', e.model);
  push('Programa', e.program);
  push('Línea', e.line);
  push('Planta', e.plant);
  push('Almacén', e.warehouse);
  push('Turno', e.shift);
  push('Cliente', e.customer);
  push('Rev', e.context?.revision);
  if (e.transaction?.quantity !== undefined && e.transaction?.quantity !== null) {
    push('Cant.', `${e.transaction.quantity}${e.transaction.unit ? ' ' + e.transaction.unit : ''}`);
  }
  return chips;
}

/** Texto plano "buscable" de un evento, para el filtro de búsqueda libre. */
export function searchableText(e: LedgerEvent): string {
  return [
    e.action,
    e.domain,
    e.referenceType,
    e.referenceId,
    e.actorName,
    e.workOrder ?? e.context?.workOrder,
    e.context?.serial,
    e.context?.lot,
    e.model,
    e.program,
    e.line,
    e.plant,
    e.metadata?.reasonCode,
    e.metadata?.reasonDesc,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
