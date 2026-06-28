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
