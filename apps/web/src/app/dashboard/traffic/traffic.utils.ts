// Pure presentation helpers for the traffic lane: palette + status/type/mode
// vocabularies (labels + colors) mirroring apps/api/.../traffic/traffic.rules.ts.
import type {
  CarrierMode,
  CarrierStatus,
  DockBoardState,
  DockStatus,
  DockType,
  DriverStatus,
  LoadingDock,
  VehicleStatus,
  VehicleType,
} from "./traffic.types";

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

// Acento del carril de logística/tráfico.
export const ACCENT = COLORS.indigo;

type Meta = { label: string; color: string };

export const CARRIER_STATUS_META: Record<CarrierStatus, Meta> = {
  active: { label: "Activo", color: COLORS.green },
  inactive: { label: "Inactivo", color: COLORS.gray },
};

export const CARRIER_MODE_META: Record<CarrierMode, Meta> = {
  GROUND: { label: "Terrestre", color: COLORS.blue },
  OCEAN: { label: "Marítimo", color: COLORS.cyan },
  AIR: { label: "Aéreo", color: COLORS.indigo },
  PARCEL: { label: "Paquetería", color: COLORS.amber },
  COURIER: { label: "Mensajería", color: COLORS.orange },
};
export const CARRIER_MODES: CarrierMode[] = ["GROUND", "OCEAN", "AIR", "PARCEL", "COURIER"];

export const VEHICLE_STATUS_META: Record<VehicleStatus, Meta> = {
  available: { label: "Disponible", color: COLORS.green },
  assigned: { label: "Asignada", color: COLORS.indigo },
  maintenance: { label: "Mantenimiento", color: COLORS.amber },
  inactive: { label: "Inactiva", color: COLORS.gray },
};

export const VEHICLE_TYPE_META: Record<VehicleType, Meta> = {
  DRY_VAN: { label: "Caja seca", color: COLORS.blue },
  REEFER: { label: "Refrigerado", color: COLORS.cyan },
  FLATBED: { label: "Plataforma", color: COLORS.orange },
  CONTAINER_20: { label: "Contenedor 20'", color: COLORS.indigo },
  CONTAINER_40: { label: "Contenedor 40'", color: COLORS.indigo },
  BOX_TRUCK: { label: "Rabón / Torton", color: COLORS.amber },
  VAN: { label: "Camioneta", color: COLORS.green },
  OTHER: { label: "Otro", color: COLORS.gray },
};
export const VEHICLE_TYPES: VehicleType[] = [
  "DRY_VAN",
  "REEFER",
  "FLATBED",
  "CONTAINER_20",
  "CONTAINER_40",
  "BOX_TRUCK",
  "VAN",
  "OTHER",
];

export const DRIVER_STATUS_META: Record<DriverStatus, Meta> = {
  available: { label: "Disponible", color: COLORS.green },
  assigned: { label: "Asignado", color: COLORS.indigo },
  inactive: { label: "Inactivo", color: COLORS.gray },
};

export const DOCK_STATUS_META: Record<DockStatus, Meta> = {
  available: { label: "Disponible", color: COLORS.green },
  occupied: { label: "Ocupado", color: COLORS.indigo },
  maintenance: { label: "Mantenimiento", color: COLORS.amber },
  inactive: { label: "Inactivo", color: COLORS.gray },
};

export const DOCK_TYPE_META: Record<DockType, Meta> = {
  shipping: { label: "Embarque", color: COLORS.indigo },
  receiving: { label: "Recibo", color: COLORS.blue },
  both: { label: "Mixto", color: COLORS.cyan },
};
export const DOCK_TYPES: DockType[] = ["shipping", "receiving", "both"];

// Avance del embarque (outbound shipment-state.ts). Solo lectura — referencia.
export const SHIPMENT_STATUS_META: Record<string, Meta> = {
  PACKING: { label: "En empaque", color: COLORS.amber },
  READY: { label: "Listo", color: COLORS.blue },
  SHIPPED: { label: "Embarcado", color: COLORS.indigo },
  DELIVERED: { label: "Entregado", color: COLORS.green },
  CANCELLED: { label: "Cancelado", color: COLORS.red },
};
export const SHIPMENT_PROGRESS: string[] = ["PACKING", "READY", "SHIPPED", "DELIVERED"];

export function shipmentStatusMeta(status?: string | null): Meta {
  return (status && SHIPMENT_STATUS_META[status]) || { label: status || "—", color: COLORS.gray };
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// ── Dock board (Tablero de andenes) ──────────────────────────────────────────
// Semáforo operativo derivado: LIBRE / OCUPADO / EN CARGA / MANTENIMIENTO.
export const DOCK_BOARD_META: Record<DockBoardState, Meta> = {
  free: { label: "Libre", color: COLORS.green },
  occupied: { label: "Ocupado", color: COLORS.indigo },
  loading: { label: "En carga", color: COLORS.orange },
  maintenance: { label: "Mantenimiento", color: COLORS.amber },
  inactive: { label: "Inactivo", color: COLORS.gray },
};
export const DOCK_BOARD_ORDER: DockBoardState[] = ["loading", "occupied", "free", "maintenance", "inactive"];

/** Estado de tablero derivado del status maestro + la marca EN CARGA. */
export function deriveBoardState(dock: Pick<LoadingDock, "status" | "loadingStartedAt">): DockBoardState {
  if (dock.status === "maintenance") return "maintenance";
  if (dock.status === "inactive") return "inactive";
  if (dock.status === "occupied") return dock.loadingStartedAt ? "loading" : "occupied";
  return "free";
}

// Umbrales de antigüedad (minutos) para semaforizar el aging del andén/unidad.
export const AGING_WARN_MIN = 120; // 2 h
export const AGING_CRIT_MIN = 240; // 4 h

/** Minutos transcurridos desde `iso` (o null si no hay fecha válida). */
export function agingMinutes(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

/** Formato compacto de antigüedad: "45m", "2h 10m", "1d 3h". */
export function fmtAging(minutes?: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

/** Color de semáforo por antigüedad (verde < warn ≤ ámbar < crit ≤ rojo). */
export function agingColor(minutes?: number | null): string {
  if (minutes == null) return COLORS.gray;
  if (minutes >= AGING_CRIT_MIN) return COLORS.red;
  if (minutes >= AGING_WARN_MIN) return COLORS.amber;
  return COLORS.green;
}
