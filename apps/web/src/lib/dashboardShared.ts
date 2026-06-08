/** Helpers compartidos por el hub y la chrome del dashboard (top bar). */

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  executive: 'Dirección',
  plant_manager: 'Gerencia de planta',
  planner: 'Planeación',
  buyer: 'Compras',
  production_supervisor: 'Producción',
  operator: 'Operador de línea',
  quality_engineer: 'Calidad',
  mrb_member: 'MRB / Calidad',
  engineering: 'Ingeniería',
  industrial_engineer: 'Ing. Industrial',
  materialist: 'Materialista',
  cycle_count_analyst: 'Conteos cíclicos',
  maintenance_tech: 'Mantenimiento',
  warehouse_operator: 'Almacén / Inventario',
  finance: 'Finanzas',
  hr: 'Personas',
};
