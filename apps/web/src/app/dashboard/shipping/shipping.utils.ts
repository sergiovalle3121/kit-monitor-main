// ─────────────────────────────────────────────────────────────────────────────
// Pure shipping helpers: status metadata, the shipment state machine (mirrors the
// real flow in apps/api/.../shipping.service.ts so the UI only offers valid moves),
// derived KPIs (there is no GET /shipping/kpis — we compute from the live list),
// and date/format utilities. Side-effect free so they're shared across the list,
// the row, the detail drawer and the action widgets.
// ─────────────────────────────────────────────────────────────────────────────
import type { Shipment, ShipmentStatus } from "./shipping.types";

// ── Paleta compartida ────────────────────────────────────────────────────────
export const COLORS = {
  green: "#10b981",
  amber: "#f59e0b",
  orange: "#f97316",
  blue: "#3b82f6",
  indigo: "#6366f1",
  cyan: "#06b6d4",
  gray: "#6b7280",
  red: "#ef4444",
} as const;

// Acento del carril (azul-camión de logística, consistente con outbound).
export const ACCENT = COLORS.blue;

// ── Estado del embarque ──────────────────────────────────────────────────────
export const STATUS_META: Record<
  ShipmentStatus,
  { label: string; color: string; hint: string }
> = {
  planning: { label: "Planeación", color: COLORS.gray, hint: "Creado; falta surtir material" },
  staged: { label: "Surtido", color: COLORS.amber, hint: "Material asignado en andén" },
  loading: { label: "Cargando", color: COLORS.blue, hint: "Manifiesto abierto, en carga" },
  dispatched: { label: "Despachado", color: COLORS.indigo, hint: "Salió de planta (en tránsito)" },
  closed: { label: "Cerrado", color: COLORS.green, hint: "Embarque cerrado" },
};

// Orden natural del ciclo de vida (para chips de filtro y agrupación).
export const STATUS_ORDER: ShipmentStatus[] = [
  "planning",
  "staged",
  "loading",
  "dispatched",
  "closed",
];

// ── Máquina de estados ───────────────────────────────────────────────────────
// Espejo del flujo REAL del servicio (cada salto es un endpoint distinto):
//   planning → staged      POST  :id/items          (addItem; auto-promueve)
//   staged   → loading      PATCH :id/start-loading  (manifiesto)
//   loading  → dispatched   PATCH :id/dispatch       (backend EXIGE status='loading')
//   dispatched → closed     PATCH :id/close
// No existe endpoint de reabrir/cancelar → 'closed' es terminal. Generar lista de
// empaque y reportar discrepancia NO cambian el estado.
const TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  planning: ["staged"],
  staged: ["loading"],
  loading: ["dispatched"],
  dispatched: ["closed"],
  closed: [],
};

export function nextStates(from: ShipmentStatus): ShipmentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminal(status: ShipmentStatus): boolean {
  return nextStates(status).length === 0;
}

/** Un embarque "vivo" sigue en operación (ni despachado ni cerrado). */
export function isOpen(status: ShipmentStatus): boolean {
  return status !== "dispatched" && status !== "closed";
}

// Capacidades por estado (qué endpoints aplican). El backend revalida cada uno.
export function canStage(status: ShipmentStatus): boolean {
  // addItem es permisivo en el backend, pero operativamente sólo tiene sentido
  // mientras el embarque no salió a carga.
  return status === "planning" || status === "staged";
}
export function canStartLoading(status: ShipmentStatus): boolean {
  return status === "staged";
}
export function canDispatch(status: ShipmentStatus): boolean {
  return status === "loading"; // coincide con el guard del backend
}
export function canClose(status: ShipmentStatus): boolean {
  return status === "dispatched";
}
export function canGeneratePackingList(status: ShipmentStatus): boolean {
  // Necesita ítems; se ofrece desde surtido y durante la carga.
  return status === "staged" || status === "loading";
}
export function canReportDiscrepancy(status: ShipmentStatus): boolean {
  return status !== "closed";
}

/** ¿La cita de embarque ya venció y aún no sale? */
export function isLate(s: Shipment, now = Date.now()): boolean {
  return isOpen(s.status) && !!s.scheduledAt && new Date(s.scheduledAt).getTime() < now;
}

// ── KPIs derivados de la lista en vivo ───────────────────────────────────────
export interface ShippingKpis {
  total: number;
  /** En operación (planning + staged + loading). */
  open: number;
  /** Surtidos esperando carga. */
  staged: number;
  /** En tránsito (despachados sin cerrar). */
  inTransit: number;
  /** Vencidos contra su cita y aún sin salir. */
  late: number;
}

export function deriveKpis(list: Shipment[], now = Date.now()): ShippingKpis {
  let open = 0;
  let staged = 0;
  let inTransit = 0;
  let late = 0;
  for (const s of list) {
    if (isOpen(s.status)) open += 1;
    if (s.status === "staged") staged += 1;
    if (s.status === "dispatched") inTransit += 1;
    if (isLate(s, now)) late += 1;
  }
  return { total: list.length, open, staged, inTransit, late };
}

/** Orden de trabajo: vivos primero, luego por cita, luego por creación reciente. */
export function compareShipments(a: Shipment, b: Shipment): number {
  const ao = isOpen(a.status) ? 0 : 1;
  const bo = isOpen(b.status) ? 0 : 1;
  if (ao !== bo) return ao - bo;
  const as = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
  const bs = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
  if (as !== bs) return as - bs;
  const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bc - ac;
}

// ── Fechas ───────────────────────────────────────────────────────────────────
export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/** Texto relativo corto en días respecto a hoy (para la cita de embarque). */
export function scheduledLabel(value?: string | null, now = Date.now()): string {
  if (!value) return "Sin cita";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "Sin cita";
  const days = Math.round((t - now) / (24 * 3_600_000));
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  if (days < 0) return `Hace ${Math.abs(days)} d`;
  return `En ${days} d`;
}

/** Convierte un <input type="datetime-local"> a ISO, o undefined si vacío/ inválido. */
export function toIso(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const d = new Date(localValue);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
