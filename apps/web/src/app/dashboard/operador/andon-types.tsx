import {
  Hand,
  HelpCircle,
  Package,
  ShieldAlert,
  Truck,
  Users,
  Wrench,
  Hammer,
} from "lucide-react";

const AMBER = "#f59e0b";
const RED = "#ef4444";

export type DowntimeReasonCode =
  | "material_shortage"
  | "quality_block"
  | "changeover"
  | "equipment_failure"
  | "process_block"
  | "safety_stop"
  | "staffing_gap"
  | "other";

export const DOWNTIME_REASON_OPTIONS: {
  code: DowntimeReasonCode;
  label: string;
  description: string;
}[] = [
  {
    code: "material_shortage",
    label: "Falta de material",
    description: "Kit, Kanban o componente crítico no disponible.",
  },
  {
    code: "quality_block",
    label: "Bloqueo calidad",
    description: "Defecto, segregación o hold impide continuar.",
  },
  {
    code: "equipment_failure",
    label: "Falla de equipo",
    description: "Máquina, fixture, tooling o prueba no responde.",
  },
  {
    code: "process_block",
    label: "Proceso detenido",
    description: "Instrucción, ruta o condición de proceso bloqueada.",
  },
  {
    code: "changeover",
    label: "Cambio de modelo",
    description: "Setup, limpieza o liberación de cambio en curso.",
  },
  {
    code: "safety_stop",
    label: "Seguridad",
    description: "Condición insegura o paro preventivo de seguridad.",
  },
  {
    code: "staffing_gap",
    label: "Falta operador",
    description: "Estación sin cobertura o skill requerido no disponible.",
  },
  {
    code: "other",
    label: "Otro",
    description: "Usar nota para detallar el motivo.",
  },
];

export const ANDON_TYPES: {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: "material",
    label: "Materiales",
    icon: <Package className="w-6 h-6" />,
    color: AMBER,
  },
  {
    id: "quality",
    label: "Calidad",
    icon: <ShieldAlert className="w-6 h-6" />,
    color: "#fb7185",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    icon: <Users className="w-6 h-6" />,
    color: "#a78bfa",
  },
  {
    id: "materialist",
    label: "Materialista",
    icon: <Truck className="w-6 h-6" />,
    color: AMBER,
  },
  {
    id: "maintenance",
    label: "Mantto",
    icon: <Wrench className="w-6 h-6" />,
    color: "#60a5fa",
  },
  {
    id: "engineering",
    label: "Ingeniería",
    icon: <HelpCircle className="w-6 h-6" />,
    color: "#22d3ee",
  },
  {
    id: "tooling",
    label: "Tooling",
    icon: <Hammer className="w-6 h-6" />,
    color: "#f97316",
  },
  {
    id: "stop",
    label: "Paro de línea",
    icon: <Hand className="w-6 h-6" />,
    color: RED,
  },
];
