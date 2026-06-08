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

export const DOMAINS: Record<DomainKey, DomainStyle> = {
  planning: { label: 'Planeación', from: '#6f6fe6', to: '#5b5bd6', solid: '#5b5bd6', text: '#5b5bd6', icon: LineChart },
  plan: { label: 'Muro del plan', from: '#9a7bff', to: '#7c5cff', solid: '#7c5cff', text: '#7c5cff', icon: Megaphone },
  staging: { label: 'Surtido a línea', from: '#4aa3ff', to: '#0a84ff', solid: '#0a84ff', text: '#0a84ff', icon: PackagePlus },
  warehouse: { label: 'Almacén', from: '#ffc24d', to: '#f5a524', solid: '#f5a524', text: '#f59e0b', icon: Warehouse },
  inventory: { label: 'Inventario', from: '#3cc2b2', to: '#16a394', solid: '#16a394', text: '#16a394', icon: Boxes },
  production: { label: 'Producción', from: '#ff9a66', to: '#ff7a45', solid: '#ff7a45', text: '#ff7a45', icon: Factory },
  mes: { label: 'MES', from: '#4fd0e0', to: '#22b8cf', solid: '#22b8cf', text: '#0f9bb3', icon: MonitorCheck },
  quality: { label: 'Calidad', from: '#4ad991', to: '#2ec27e', solid: '#2ec27e', text: '#2ec27e', icon: ShieldCheck },
  engineering: { label: 'Ingeniería', from: '#7c84ff', to: '#5b63e0', solid: '#5b63e0', text: '#5b63e0', icon: Cpu },
  finance: { label: 'Finanzas', from: '#34d1bf', to: '#0fb39a', solid: '#0fb39a', text: '#0fb39a', icon: DollarSign },
  people: { label: 'Personas', from: '#ff7db0', to: '#ff4d8d', solid: '#ff4d8d', text: '#ff4d8d', icon: Users },
  office: { label: 'Office', from: '#aab2c0', to: '#7e8796', solid: '#7e8796', text: '#6b7280', icon: FileText },
  erp: { label: 'Axos ERP', from: '#9a7bff', to: '#7c5cff', solid: '#7c5cff', text: '#7c5cff', icon: Landmark },
  messaging: { label: 'Mensajería', from: '#4aa3ff', to: '#0a84ff', solid: '#0a84ff', text: '#0a84ff', icon: MessageCircle },
};

/** Grosor de línea único para TODOS los íconos del sistema. */
export const ICON_STROKE = 1.75;

/** Estilo de la loseta squircle (gradiente + sombra de color + brillo interior). */
export function domainTile(domain: DomainKey): CSSProperties {
  const d = DOMAINS[domain];
  return {
    background: `linear-gradient(135deg, ${d.from}, ${d.to})`,
    boxShadow: `0 6px 14px ${d.solid}40, inset 0 1px 0 rgba(255,255,255,.35)`,
  };
}
