import type { CSSProperties } from 'react';
import {
  LineChart,
  Megaphone,
  PackagePlus,
  Warehouse,
  Boxes,
  Factory,
  MonitorCheck,
  ShieldCheck,
  Cpu,
  DollarSign,
  Users,
  FileText,
  Landmark,
  MessageCircle,
  Truck,
  type LucideIcon,
} from 'lucide-react';

/**
 * Sistema de diseño "Apple": la paleta por DOMINIO es la ÚNICA fuente de verdad.
 * Cada departamento conserva su color + símbolo en TODA la app (tarjeta del hub,
 * header de su página, notificaciones, badges). No repintar íconos sobre gris.
 *
 * Una sola familia de íconos (lucide), un solo grosor (strokeWidth 1.75).
 */
export type DomainKey =
  | 'planning'
  | 'plan'
  | 'staging'
  | 'warehouse'
  | 'inventory'
  | 'production'
  | 'mes'
  | 'quality'
  | 'engineering'
  | 'finance'
  | 'people'
  | 'office'
  | 'erp'
  | 'logistics'
  | 'messaging';

export interface DomainStyle {
  label: string;
  /** Gradiente 135°: tono claro → base. */
  from: string;
  to: string;
  /** Color sólido base del dominio (para sombras y acentos). */
  solid: string;
  /** Color del texto/numero de acento (legible sobre tarjeta clara y oscura). */
  text: string;
  icon: LucideIcon;
}

/**
 * Paleta de dominio REFINADA (renovación visual): ~15–25 % menos chroma que la
 * versión "viva" anterior. Cada tono es más profundo y sobrio — sigue siendo la
 * FIRMA reconocible de cada departamento, pero premium y sin neón. El acento de
 * sistema (índigo) gobierna lo interactivo; el color de dominio es solo identidad.
 */
export const DOMAINS: Record<DomainKey, DomainStyle> = {
  planning: { label: 'Planeación', from: '#6a6adf', to: '#5757cf', solid: '#5757cf', text: '#5757cf', icon: LineChart },
  plan: { label: 'Muro del plan', from: '#8a76e0', to: '#6d59d2', solid: '#6d59d2', text: '#6d59d2', icon: Megaphone },
  staging: { label: 'Surtido a línea', from: '#5793db', to: '#2f73cc', solid: '#2f73cc', text: '#2f73cc', icon: PackagePlus },
  warehouse: { label: 'Almacén', from: '#eab64f', to: '#d8962f', solid: '#d8962f', text: '#c08329', icon: Warehouse },
  inventory: { label: 'Inventario', from: '#3aab9d', to: '#179486', solid: '#179486', text: '#168577', icon: Boxes },
  production: { label: 'Producción', from: '#ec8a5f', to: '#df6f43', solid: '#df6f43', text: '#cf6335', icon: Factory },
  mes: { label: 'MES', from: '#4bb6c6', to: '#239fb3', solid: '#239fb3', text: '#0f8ca1', icon: MonitorCheck },
  quality: { label: 'Calidad', from: '#46c184', to: '#2da872', solid: '#2da872', text: '#2a9c69', icon: ShieldCheck },
  engineering: { label: 'Ingeniería', from: '#727ae0', to: '#545cd0', solid: '#545cd0', text: '#545cd0', icon: Cpu },
  finance: { label: 'Finanzas', from: '#33b8a8', to: '#17a18d', solid: '#17a18d', text: '#159080', icon: DollarSign },
  people: { label: 'Personas', from: '#e878a0', to: '#d9527f', solid: '#d9527f', text: '#d34d7a', icon: Users },
  office: { label: 'Office', from: '#aab2c0', to: '#7e8796', solid: '#7e8796', text: '#6b7280', icon: FileText },
  erp: { label: 'Axos ERP', from: '#8a76e0', to: '#6d59d2', solid: '#6d59d2', text: '#6d59d2', icon: Landmark },
  logistics: { label: 'Logística', from: '#5b95df', to: '#3a7ad6', solid: '#3a7ad6', text: '#3a7ad6', icon: Truck },
  messaging: { label: 'Mensajería', from: '#5793db', to: '#2f73cc', solid: '#2f73cc', text: '#2f73cc', icon: MessageCircle },
};

/** Grosor de línea único para TODOS los íconos del sistema. */
export const ICON_STROKE = 1.75;

/** Estilo de la loseta squircle: gradiente del dominio + sombra NEUTRA suave
 *  (materialidad, no glow de color) + brillo interior tenue. */
export function domainTile(domain: DomainKey): CSSProperties {
  const d = DOMAINS[domain];
  return {
    background: `linear-gradient(135deg, ${d.from}, ${d.to})`,
    boxShadow: `0 2px 6px -1px ${d.solid}26, 0 4px 12px -4px rgba(15,23,42,.12), inset 0 1px 0 rgba(255,255,255,.28)`,
  };
}
