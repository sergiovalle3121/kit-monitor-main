export const AXOS_ENTITY_LABELS: Record<string, string> = {
  work_order: 'Work Order',
  bom: 'BOM',
  routing: 'Routing',
  model: 'Modelo',
  ncr: 'NCR',
  capa: 'CAPA',
  supplier: 'Proveedor',
  customer: 'Cliente',
  material: 'Material',
  engineering_change: 'Engineering Change',
  maintenance_order: 'Mantenimiento',
  fixture: 'Fixture',
  test_program: 'Programa de prueba',
  project: 'Proyecto',
};

const ROUTES: Record<string, (id: string) => string> = {
  work_order: (id) => `/dashboard/production?wo=${encodeURIComponent(id)}`,
  bom: (id) => `/dashboard/bom/${encodeURIComponent(id)}`,
  routing: (id) => `/dashboard/routing/${encodeURIComponent(id)}`,
  model: (id) => `/dashboard/models/${encodeURIComponent(id)}`,
  ncr: (id) => `/dashboard/quality/ncr/${encodeURIComponent(id)}`,
  capa: (id) => `/dashboard/improvement/${encodeURIComponent(id)}`,
  supplier: (id) => `/dashboard/suppliers/${encodeURIComponent(id)}`,
  customer: (id) => `/dashboard/customers/${encodeURIComponent(id)}`,
  material: (id) => `/dashboard/materials/${encodeURIComponent(id)}`,
  engineering_change: (id) => `/dashboard/engineering?change=${encodeURIComponent(id)}`,
  maintenance_order: (id) => `/dashboard/maintenance?order=${encodeURIComponent(id)}`,
  fixture: (id) => `/dashboard/test-engineering?fixture=${encodeURIComponent(id)}`,
  test_program: (id) => `/dashboard/test-engineering?program=${encodeURIComponent(id)}`,
  project: (id) => `/dashboard/npi/${encodeURIComponent(id)}`,
};

export function axosEntityLabel(entity?: string): string {
  return AXOS_ENTITY_LABELS[String(entity || '').toLowerCase()] || String(entity || 'AXOS').replace(/_/g, ' ').toUpperCase();
}

export function axosRefHref(entity?: string, refId?: string): string | null {
  const key = String(entity || '').toLowerCase();
  const id = String(refId || '').trim();
  if (!id || !ROUTES[key]) return null;
  return ROUTES[key](id);
}

export function axosRefText(entity?: string, refId?: string, label?: string): string {
  const cleanLabel = String(label || '').trim();
  if (cleanLabel) return cleanLabel;
  const cleanId = String(refId || '').trim();
  return cleanId ? `${axosEntityLabel(entity)} ${cleanId}` : axosEntityLabel(entity);
}
