import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Megaphone, PackageCheck, Warehouse, LineChart,
  Boxes, Factory, ShieldCheck, Cpu, DollarSign, RadioTower, FileText,
} from "lucide-react";
import type { DomainKey } from "@/lib/design/domains";

/**
 * Catálogo compartido de áreas del dashboard. Es la fuente única que consumen el
 * hub (apps/web/src/app/dashboard/page.tsx) y la tira de wayfinding del shell
 * (DashboardWayfinding). Extraído del hub SIN cambios de contenido ni orden para
 * que ambos compartan exactamente el mismo filtrado por rol.
 */
export type DashboardArea = {
  name: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  domain: DomainKey;
  roles: string[];
  section: string;
};

// The working areas of the app, grouped by the REAL operational flow so the hub
// reads like the process: Diseño/NPI → Planeación → Materiales → Producción →
// Calidad → Finanzas/ERP → Control → Administración. Each user sees only the
// areas for their role (admin/executive/owner see all). Nothing is deleted —
// areas are reordered + grouped (re-IA, not removal).
export const AREAS: DashboardArea[] = [
  // ── Diseño · NPI ──
  { name: "Modelos · NPI", desc: "Maestro de productos", href: "/dashboard/models", icon: Boxes, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Maestro de Materiales", desc: "Partes, AVL y alternantes (MM)", href: "/dashboard/materials", icon: Icons.Package, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor", "buyer"], section: "Diseño · NPI" },
  { name: "BOM Multinivel", desc: "Estructuras N niveles + explosión", href: "/dashboard/bom", icon: Icons.Network, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Ruteo de Manufactura", desc: "Operaciones, tiempos y consumo", href: "/dashboard/routing", icon: Icons.Workflow, domain: "engineering", roles: ["industrial_engineer", "engineering", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Ayudas Visuales", desc: "Instructivos de trabajo por estación", href: "/dashboard/visual-aids", icon: Icons.FileText, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor", "operator"], section: "Diseño · NPI" },
  { name: "Tooling · Herramentales", desc: "Moldes, fixtures y vida en disparos", href: "/dashboard/tooling", icon: Icons.Hammer, domain: "engineering", roles: ["engineering", "industrial_engineer", "maintenance_tech", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Importar Datos", desc: "Migración: materiales, BOM, ruteo", href: "/dashboard/import", icon: Icons.Upload, domain: "erp", roles: ["engineering", "industrial_engineer", "planner", "buyer"], section: "Diseño · NPI" },
  { name: "Ingeniería", desc: "BOM y proceso", href: "/dashboard/engineering", icon: Cpu, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Ing. Industrial", desc: "Proceso, capacidad y mejora", href: "/dashboard/industrial-engineering", icon: Icons.Gauge, domain: "engineering", roles: ["engineering", "industrial_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Disposición de líneas", desc: "Layout, ruteo y balanceo", href: "/dashboard/line-engineering", icon: Icons.Gauge, domain: "engineering", roles: ["industrial_engineer", "engineering", "production_supervisor"], section: "Diseño · NPI" },

  // ── Planeación ──
  { name: "Planeación", desc: "Publicar planes", href: "/dashboard/planning", icon: LineChart, domain: "planning", roles: ["planner"], section: "Planeación" },
  { name: "Muro del plan", desc: "Publicar WOs en vivo", href: "/dashboard/production-plan", icon: Megaphone, domain: "plan", roles: ["planner", "production_supervisor", "operator", "materialist"], section: "Planeación" },
  { name: "MRP · Requerimiento neto", desc: "Demanda vs existencias → órdenes", href: "/dashboard/mrp", icon: Icons.Calculator, domain: "planning", roles: ["planner", "buyer", "production_supervisor", "materialist"], section: "Planeación" },
  { name: "Pronóstico", desc: "Demanda Monte Carlo (P10/P50/P90)", href: "/dashboard/forecast", icon: Icons.TrendingUp, domain: "planning", roles: ["planner", "finance", "production_supervisor"], section: "Planeación" },
  { name: "Compras · Procurement", desc: "Órdenes de compra y OTD", href: "/dashboard/procurement", icon: Icons.ShoppingCart, domain: "planning", roles: ["buyer", "planner"], section: "Planeación" },
  { name: "Proveedores", desc: "AVL, scorecard y estatus", href: "/dashboard/suppliers", icon: Icons.Truck, domain: "planning", roles: ["buyer", "planner", "quality_engineer"], section: "Planeación" },

  // ── Materiales ──
  { name: "Recibo", desc: "Recepción, IQC y putaway", href: "/dashboard/inbound", icon: PackageCheck, domain: "warehouse", roles: ["warehouse_operator", "materialist", "quality_engineer"], section: "Materiales" },
  { name: "Inventario", desc: "Existencias y kitting", href: "/dashboard/inventory", icon: Boxes, domain: "inventory", roles: ["warehouse_operator", "materialist", "cycle_count_analyst", "planner"], section: "Materiales" },
  { name: "Surtido a línea", desc: "Kitting y e-kanban", href: "/dashboard/material-staging", icon: Icons.PackagePlus, domain: "staging", roles: ["materialist", "warehouse_operator", "production_supervisor"], section: "Materiales" },
  { name: "Almacén", desc: "Surtir y autorizar", href: "/dashboard/almacen", icon: Warehouse, domain: "warehouse", roles: ["warehouse_operator", "materialist"], section: "Materiales" },
  { name: "Tareas de Almacén · WMS", desc: "Acomodo, traslado y surtido", href: "/dashboard/warehouse", icon: Icons.ClipboardList, domain: "warehouse", roles: ["warehouse_operator", "materialist"], section: "Materiales" },
  { name: "Conteos Cíclicos", desc: "Exactitud de inventario", href: "/dashboard/cycle-counts", icon: Icons.ListChecks, domain: "inventory", roles: ["cycle_count_analyst", "warehouse_operator", "materialist"], section: "Materiales" },

  // ── Producción ──
  { name: "Producción", desc: "Órdenes y piso", href: "/dashboard/production", icon: Factory, domain: "production", roles: ["production_supervisor", "operator", "warehouse_operator"], section: "Producción" },
  { name: "Operador MES", desc: "Ejecución en estación", href: "/dashboard/operador", icon: Icons.HardHat, domain: "production", roles: ["production_supervisor", "operator"], section: "Producción" },
  { name: "Flujo de Pruebas", desc: "Serie: ensamble → prueba → destino", href: "/dashboard/test-flow", icon: Icons.Workflow, domain: "production", roles: ["production_supervisor", "operator", "quality_engineer"], section: "Producción" },
  { name: "Backflush por ruteo", desc: "Consumo por operación del ruteo", href: "/dashboard/backflush", icon: Icons.PackageMinus, domain: "production", roles: ["production_supervisor", "materialist", "operator"], section: "Producción" },
  { name: "Monitor en Vivo", desc: "Andon, OEE y semáforo por línea", href: "/dashboard/live", icon: Icons.Radio, domain: "mes", roles: ["production_supervisor", "operator", "plant_manager", "planner"], section: "Producción" },
  { name: "Mantenimiento · TPM", desc: "Activos y órdenes (CMMS)", href: "/dashboard/maintenance", icon: Icons.Wrench, domain: "production", roles: ["maintenance_tech", "production_supervisor", "plant_manager"], section: "Producción" },

  // ── Calidad ──
  { name: "Calidad", desc: "Inspección y NCR", href: "/dashboard/quality", icon: ShieldCheck, domain: "quality", roles: ["quality_engineer", "mrb_member"], section: "Calidad" },
  { name: "Calidad de piso · MRB", desc: "Holds y disposición", href: "/dashboard/floor-quality", icon: Icons.ShieldX, domain: "quality", roles: ["quality_engineer", "mrb_member", "production_supervisor"], section: "Calidad" },
  { name: "Pruebas / Lab", desc: "Inspección y validación", href: "/dashboard/lab", icon: Icons.FlaskConical, domain: "quality", roles: ["quality_engineer", "engineering"], section: "Calidad" },
  { name: "Test Engineering", desc: "Yields, FPY y Pareto de fallas", href: "/dashboard/test-engineering", icon: Icons.Sigma, domain: "quality", roles: ["quality_engineer", "engineering", "industrial_engineer"], section: "Calidad" },
  { name: "RMA · Quejas", desc: "Devoluciones de cliente y 8D", href: "/dashboard/rma", icon: Icons.PackageX, domain: "quality", roles: ["quality_engineer", "mrb_member"], section: "Calidad" },
  { name: "Genealogía", desc: "Trazabilidad cuna-a-tumba", href: "/dashboard/genealogy", icon: Icons.Network, domain: "quality", roles: ["quality_engineer", "mrb_member", "engineering", "production_supervisor"], section: "Calidad" },

  // ── Logística ── (suite de embarques: empaque → carga verificada → tráfico → ASN)
  { name: "Embarques", desc: "Embarque, carga verificada y ASN", href: "/dashboard/outbound", icon: Icons.Truck, domain: "logistics", roles: ["warehouse_operator", "materialist", "production_supervisor", "planner"], section: "Logística" },
  { name: "Empaque", desc: "Tarimas, SSCC y etiqueta GS1", href: "/dashboard/packing", icon: Icons.Package, domain: "logistics", roles: ["warehouse_operator", "materialist"], section: "Logística" },
  { name: "Tráfico", desc: "Transportistas, unidades y andenes", href: "/dashboard/traffic", icon: Icons.Route, domain: "logistics", roles: ["warehouse_operator", "planner", "production_supervisor"], section: "Logística" },

  // ── Finanzas · ERP ──
  { name: "Finanzas", desc: "Costos y P&L", href: "/dashboard/finance", icon: DollarSign, domain: "finance", roles: ["finance"], section: "Finanzas · ERP" },
  { name: "Costos y métricas", desc: "Dinero y eficiencia", href: "/dashboard/metrics", icon: Icons.Activity, domain: "finance", roles: ["finance", "planner", "production_supervisor"], section: "Finanzas · ERP" },
  { name: "Activos Fijos", desc: "Depreciación y valor en libros", href: "/dashboard/fixed-assets", icon: Icons.Building, domain: "finance", roles: ["finance"], section: "Finanzas · ERP" },
  { name: "Gastos · Viáticos", desc: "Reportes y reembolsos", href: "/dashboard/expenses", icon: Icons.Receipt, domain: "finance", roles: ["finance", "buyer", "production_supervisor"], section: "Finanzas · ERP" },
  { name: "Axos ERP", desc: "FIN · MM · PP · SD · T-Codes", href: "/dashboard/erp", icon: Icons.Landmark, domain: "erp", roles: ["finance", "planner", "production_supervisor", "buyer"], section: "Finanzas · ERP" },

  // ── Control e inteligencia ──
  { name: "Centro de Inteligencia", desc: "Capa semántica: métricas y ontología (CIDE)", href: "/dashboard/intelligence", icon: Icons.BrainCircuit, domain: "mes", roles: ["plant_manager", "planner", "production_supervisor", "finance", "quality_engineer", "engineering"], section: "Control e inteligencia" },
  { name: "Mission Control", desc: "Vista ejecutiva", href: "/dashboard/mission-control", icon: RadioTower, domain: "mes", roles: ["planner", "production_supervisor", "finance"], section: "Control e inteligencia" },
  { name: "Clientes 360", desc: "Vista cross-área por cliente", href: "/dashboard/customers", icon: Icons.Building2, domain: "finance", roles: ["finance", "planner", "production_supervisor", "plant_manager"], section: "Control e inteligencia" },
  { name: "Torre de Control", desc: "Cockpit ejecutivo cross-área", href: "/dashboard/control-tower", icon: RadioTower, domain: "mes", roles: ["plant_manager", "planner", "production_supervisor", "finance"], section: "Control e inteligencia" },
  { name: "Torre de control de línea", desc: "Readiness y semáforo por línea", href: "/dashboard/line-control-tower", icon: RadioTower, domain: "mes", roles: ["production_supervisor", "planner", "plant_manager"], section: "Control e inteligencia" },
  { name: "Reportes", desc: "CoC, trazabilidad, calidad y producción", href: "/dashboard/reports", icon: Icons.FileCheck2, domain: "quality", roles: ["quality_engineer", "planner", "production_supervisor", "finance"], section: "Control e inteligencia" },
  { name: "Bitácora · Eventos", desc: "Event Ledger inmutable (auditoría)", href: "/dashboard/activity", icon: Icons.ScrollText, domain: "mes", roles: ["quality_engineer", "production_supervisor", "plant_manager"], section: "Control e inteligencia" },
  { name: "Mejora Continua", desc: "Kaizen, Lean y 6σ", href: "/dashboard/improvement", icon: Icons.Lightbulb, domain: "engineering", roles: ["industrial_engineer", "engineering", "production_supervisor", "quality_engineer"], section: "Control e inteligencia" },

  // ── Administración ──
  { name: "Personas (RH)", desc: "Plantilla y accesos", href: "/dashboard/rh", icon: Icons.Users, domain: "people", roles: ["hr"], section: "Administración" },
  { name: "Skills · Certificaciones", desc: "Matriz de habilidades y recerts", href: "/dashboard/skills", icon: Icons.GraduationCap, domain: "people", roles: ["hr", "production_supervisor", "quality_engineer"], section: "Administración" },
  { name: "EHS · Seguridad", desc: "Incidentes y casi-accidentes", href: "/dashboard/ehs", icon: Icons.ShieldAlert, domain: "people", roles: ["hr", "production_supervisor", "maintenance_tech"], section: "Administración" },
  { name: "Legal · Contratos", desc: "Contratos, vencimientos y renovaciones", href: "/dashboard/legal", icon: Icons.Scale, domain: "office", roles: ["finance", "hr", "plant_manager"], section: "Administración" },
  { name: "CRM · Pipeline", desc: "Oportunidades de venta", href: "/dashboard/crm", icon: Icons.Target, domain: "finance", roles: ["finance"], section: "Administración" },
  { name: "Office", desc: "Docs · Hojas · Slides", href: "/dashboard/office", icon: FileText, domain: "office", roles: ["engineering", "planner", "quality_engineer", "production_supervisor", "warehouse_operator", "finance", "buyer", "hr"], section: "Administración" },
];

// Order the flow sections render in.
export const SECTION_ORDER = [
  "Diseño · NPI", "Planeación", "Materiales", "Producción",
  "Calidad", "Logística", "Finanzas · ERP", "Control e inteligencia", "Administración",
];
