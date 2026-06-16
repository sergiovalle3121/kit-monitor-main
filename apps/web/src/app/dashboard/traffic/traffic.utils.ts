// Pure presentation helpers for the traffic lane: palette + status/type/mode
// vocabularies (labels + colors) mirroring apps/api/.../traffic/traffic.rules.ts.
import type {
  CarrierMode,
  CarrierStatus,
  DockStatus,
  DockType,
  DriverStatus,
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

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
