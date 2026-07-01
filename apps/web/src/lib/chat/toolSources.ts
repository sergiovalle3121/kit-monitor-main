/**
 * Maps a CIDE grounding tool to the dashboard module it reads from, so the chat
 * can show **clickable evidence** under each answer ("Fuentes: Inventario,
 * Calidad…"). Deterministic provenance: the user can jump to the same module the
 * copilot consulted. Tools without a obvious page (pure analytics, proposals)
 * return null and simply don't render a link.
 */
export interface ToolSource {
  label: string;
  href: string;
}

const SOURCES: Record<string, ToolSource> = {
  // Inventario / materiales
  list_inventory: { label: 'Inventario', href: '/dashboard/inventory' },
  inventory_valuation: { label: 'Inventario', href: '/dashboard/inventory' },
  // Producción / planeación
  list_production_plans: { label: 'Producción', href: '/dashboard/production' },
  scheduling_intelligence: { label: 'Producción', href: '/dashboard/production' },
  list_mrp_runs: { label: 'MRP', href: '/dashboard/mrp' },
  // Calidad
  quality_holds: { label: 'Calidad', href: '/dashboard/quality' },
  list_capas: { label: 'Calidad', href: '/dashboard/quality' },
  fai_records: { label: 'Calidad', href: '/dashboard/quality' },
  rma_cases: { label: 'RMA', href: '/dashboard/rma' },
  // Mantenimiento / herramentales
  maintenance_orders: { label: 'Mantenimiento', href: '/dashboard/maintenance' },
  maintenance_assets: { label: 'Mantenimiento', href: '/dashboard/maintenance' },
  maintenance_pm_plans: {
    label: 'Mantenimiento',
    href: '/dashboard/maintenance',
  },
  list_tools: { label: 'Herramentales', href: '/dashboard/tooling' },
  // EHS
  safety_incidents: { label: 'EHS', href: '/dashboard/ehs' },
  // Logística
  list_shipments: { label: 'Embarques', href: '/dashboard/shipping' },
  // Compras / proveedores
  list_suppliers: { label: 'Proveedores', href: '/dashboard/suppliers' },
  supplier_prices: { label: 'Proveedores', href: '/dashboard/suppliers' },
  list_purchase_requisitions: {
    label: 'Compras',
    href: '/dashboard/procurement',
  },
  // Clientes
  list_customers: { label: 'Clientes', href: '/dashboard/customers' },
  // Finanzas
  income_statement: { label: 'Finanzas', href: '/dashboard/finance' },
  balance_sheet: { label: 'Finanzas', href: '/dashboard/finance' },
  trial_balance: { label: 'Finanzas', href: '/dashboard/finance' },
  ar_ap_aging: { label: 'Finanzas', href: '/dashboard/finance' },
  // Ingeniería / trazabilidad
  bom_headers: { label: 'Ingeniería', href: '/dashboard/engineering' },
  visual_aids: { label: 'Ayudas visuales', href: '/dashboard/visual-aids' },
  genealogy_links: { label: 'Genealogía', href: '/dashboard/genealogy' },
  // Métricas / bitácora
  kpi_alerts: { label: 'Métricas', href: '/dashboard/metrics' },
  list_metrics: { label: 'Métricas', href: '/dashboard/metrics' },
  metric_value: { label: 'Métricas', href: '/dashboard/metrics' },
  operations_pulse: { label: 'Bitácora', href: '/dashboard/activity' },
  ledger_trace: { label: 'Bitácora', href: '/dashboard/activity' },
  analyze_trend: { label: 'Bitácora', href: '/dashboard/activity' },
};

/** Source page for a tool, or null if it has no obvious page to link to. */
export function toolSource(tool: string): ToolSource | null {
  return SOURCES[tool] ?? null;
}

/** Distinct sources (by label) for a set of used tools, preserving order. */
export function sourcesFor(tools: string[]): ToolSource[] {
  const out: ToolSource[] = [];
  const seen = new Set<string>();
  for (const t of tools) {
    const src = toolSource(t);
    if (src && !seen.has(src.label)) {
      seen.add(src.label);
      out.push(src);
    }
  }
  return out;
}
