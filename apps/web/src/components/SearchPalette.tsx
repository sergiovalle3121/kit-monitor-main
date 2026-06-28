'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Search, LayoutGrid, LineChart, Warehouse, Boxes, Factory, HardHat, ShieldCheck,
  Cpu, DollarSign, Calculator, RadioTower, FileText, Landmark, Users, Building2,
  ShieldAlert, MessageSquare, CornerDownLeft, Hash, Lightbulb, Wrench, Scale, FlaskConical, ShoppingCart, GraduationCap, Truck, PackageCheck, ClipboardList, Target, Building, Receipt, Hammer, PackageX, Package,
  Gauge, Megaphone, PackagePlus, ShieldX, Loader2, Network, Workflow, Upload, PackageMinus, Rocket,
} from 'lucide-react';
import {
  ENTITY_ORDER, ensureSearchIndex, filterSearchIndex,
  type SearchHit, type SearchKind,
} from './searchSources';

interface Dest {
  label: string;
  sub: string;
  href: string;
  keywords: string;
  icon: React.ElementType;
}

// Catálogo de destinos navegables (búsqueda general "ir a…", estilo Linear/Cmd-K).
// Los T-Codes viven aparte, dentro del ERP.
const DESTS: Dest[] = [
  { label: 'Inicio', sub: 'Hub', href: '/dashboard', keywords: 'hub home inicio panel', icon: LayoutGrid },
  { label: 'Planeación', sub: 'Publicar planes', href: '/dashboard/planning', keywords: 'plan plan de produccion wo orden', icon: LineChart },
  { label: 'Almacén', sub: 'Surtir y autorizar', href: '/dashboard/almacen', keywords: 'almacen warehouse surtido material', icon: Warehouse },
  { label: 'Inventario', sub: 'Existencias y kitting', href: '/dashboard/inventory', keywords: 'inventario stock existencias kitting', icon: Boxes },
  { label: 'Producción', sub: 'Órdenes y piso', href: '/dashboard/production', keywords: 'produccion piso ordenes wo lineas', icon: Factory },
  { label: 'Operador MES', sub: 'Ejecución en estación', href: '/dashboard/operador', keywords: 'mes operador escanear estacion montar wo', icon: HardHat },
  { label: 'Calidad', sub: 'Inspección y NCR', href: '/dashboard/quality', keywords: 'calidad quality ncr inspeccion capa holds', icon: ShieldCheck },
  { label: 'NPI Launch Center', sub: 'Lanzamiento · readiness · gates · riesgos · liberación', href: '/dashboard/npi', keywords: 'npi launch lanzamiento gates readiness riesgos liberacion mp release dossier introduccion nuevo producto', icon: Rocket },
  { label: 'Product Master', sub: 'Maestro de productos/modelos', href: '/dashboard/models', keywords: 'modelos modelo producto productos npi master maestro mdl numero de parte folio nuevo modelo product master', icon: Boxes },
  { label: 'Maestro de Materiales', sub: 'Partes · AVL · alternantes', href: '/dashboard/materials', keywords: 'materiales material maestro parte partes mm avl fabricante mpn alternante sustituto comprado fabricado phantom uom make buy numero de parte mat', icon: Package },
  { label: 'BOM Multinivel', sub: 'Estructura · explosión · where-used', href: '/dashboard/bom', keywords: 'bom estructura producto multinivel explosion explotar where used donde se usa ensamble subensamble componentes lista de materiales arbol niveles', icon: Network },
  { label: 'Ruteo de Manufactura', sub: 'Operaciones · tiempos · centro de trabajo', href: '/dashboard/routing', keywords: 'ruteo routing ruta proceso operaciones secuencia centro de trabajo work center tiempo estandar setup run backflush consumo manufactura rt', icon: Workflow },
  { label: 'Importar Datos', sub: 'Migración SAP · CSV/Excel/staging', href: '/dashboard/import', keywords: 'importar import migracion sap csv excel xlsx staging idoc api mapeo columnas material bom ruteo carga masiva subir archivo', icon: Upload },
  { label: 'Backflush por ruteo', sub: 'Consumo por operación', href: '/dashboard/backflush', keywords: 'backflush consumo operacion ruteo routing inventario descontar material rt_operation_material produccion unidades', icon: PackageMinus },
  { label: 'MRP · Requerimiento neto', sub: 'Demanda vs existencias', href: '/dashboard/mrp', keywords: 'mrp requerimiento neto netting demanda existencias escasez faltante explosion bom sugerencia orden compra fabricacion planeacion material', icon: Calculator },
  { label: 'Ingeniería', sub: 'BOM y proceso', href: '/dashboard/engineering', keywords: 'ingenieria engineering bom ruta proceso npi', icon: Cpu },
  { label: 'Finanzas', sub: 'Costos y P&L', href: '/dashboard/finance', keywords: 'finanzas finance costos dinero movimientos', icon: DollarSign },
  { label: 'Costeo por orden', sub: 'Cost rollup', href: '/dashboard/finance/cost-rollup', keywords: 'costo costeo rollup wo mano de obra material', icon: Calculator },
  { label: 'Mejora continua', sub: 'Kaizen · Lean · 6σ', href: '/dashboard/improvement', keywords: 'mejora continua kaizen lean six sigma opex ahorros iniciativas 5s', icon: Lightbulb },
  { label: 'EHS · Seguridad', sub: 'Incidentes y casi-accidentes', href: '/dashboard/ehs', keywords: 'ehs seguridad medio ambiente incidentes casi accidente near miss safety lesiones recordable', icon: ShieldAlert },
  { label: 'Mantenimiento · TPM', sub: 'Activos y órdenes (CMMS)', href: '/dashboard/maintenance', keywords: 'mantenimiento tpm cmms activos equipos ordenes preventivo correctivo mtbf mttr averias paros', icon: Wrench },
  { label: 'Legal · Contratos', sub: 'Contratos y vencimientos', href: '/dashboard/legal', keywords: 'legal contratos compliance vencimiento renovacion nda proveedor cliente acuerdos', icon: Scale },
  { label: 'Test Engineering', sub: 'Yields y Pareto de fallas', href: '/dashboard/test-engineering', keywords: 'test engineering pruebas yield fpy first pass rendimiento pareto fallas ict fct aoi ensayo', icon: FlaskConical },
  { label: 'Flujo de Pruebas', sub: 'Ensamble → prueba → destino', href: '/dashboard/test-flow', keywords: 'flujo pruebas serie serial ensamble prueba empaque disposicion cola queue trazabilidad destino mes', icon: Workflow },
  { label: 'Compras · Procurement', sub: 'Órdenes de compra y OTD', href: '/dashboard/procurement', keywords: 'compras procurement po orden de compra proveedor sourcing otd recepcion purchasing', icon: ShoppingCart },
  { label: 'RH · Skills', sub: 'Certificaciones y matriz', href: '/dashboard/skills', keywords: 'rh skills habilidades certificaciones matriz capacitacion recertificacion empleados ipc esd', icon: GraduationCap },
  { label: 'Personas (RH)', sub: 'Capital humano', href: '/dashboard/rh', keywords: 'rh recursos humanos personas capital humano hr generalista analista plantilla', icon: Users },
  { label: 'Plantilla · Colaboradores', sub: 'Maestro de personal y headcount', href: '/dashboard/rh/plantilla', keywords: 'rh plantilla colaboradores empleados headcount alta baja directo indirecto turno nomina personal', icon: Users },
  { label: 'Analítica de fuerza laboral', sub: 'Rotación, ausentismo y staffing', href: '/dashboard/rh/analitica', keywords: 'rh analitica people analytics rotacion turnover ausentismo attrition headcount riesgo staffing flight risk costo mano de obra', icon: Gauge },
  { label: 'Reclutamiento', sub: 'Vacantes, pipeline y time-to-fill', href: '/dashboard/rh/reclutamiento', keywords: 'rh reclutamiento seleccion vacantes requisiciones candidatos pipeline ats contratacion time to fill rampa', icon: ClipboardList },
  { label: 'Desempeño y 9-box', sub: 'Evaluaciones, talento y sucesión', href: '/dashboard/rh/desempeno', keywords: 'rh desempeno performance evaluacion 9-box nine box talento potencial sucesion calibracion objetivos', icon: Target },
  { label: 'Logística · Embarque', sub: 'Embarques, ASN y OTD', href: '/dashboard/outbound', keywords: 'logistica embarque shipping outbound asn entrega otd carrier guia tracking incoterm aduana', icon: Truck },
  { label: 'Recibo · Inbound', sub: 'Recepción e IQC', href: '/dashboard/inbound', keywords: 'recibo inbound recepcion iqc inspeccion entrada lote cuarentena dock to stock proveedor material', icon: PackageCheck },
  { label: 'Conteos Cíclicos', sub: 'Exactitud de inventario', href: '/dashboard/cycle-counts', keywords: 'conteos ciclicos cycle count exactitud inventario varianza ajuste reconciliacion almacen', icon: ClipboardList },
  { label: 'CRM · Pipeline', sub: 'Oportunidades de venta', href: '/dashboard/crm', keywords: 'crm pipeline oportunidades ventas sales pronostico forecast win rate cliente prospecto sd', icon: Target },
  { label: 'Activos Fijos', sub: 'Depreciación y libros', href: '/dashboard/fixed-assets', keywords: 'activos fijos fixed assets depreciacion linea recta valor en libros capitalizacion maquinaria fin', icon: Building },
  { label: 'Gastos · Viáticos', sub: 'Reportes y reembolsos', href: '/dashboard/expenses', keywords: 'gastos viaticos expenses reembolso aprobacion ap viaje comidas hospedaje finanzas', icon: Receipt },
  { label: 'Tooling · Herramentales', sub: 'Moldes y vida en disparos', href: '/dashboard/tooling', keywords: 'tooling herramentales moldes fixtures stencil galga vida disparos shots eol mantenimiento npi', icon: Hammer },
  { label: 'RMA · Quejas', sub: 'Devoluciones de cliente', href: '/dashboard/rma', keywords: 'rma quejas devoluciones cliente complaint return calidad disposicion reparar reemplazar credito 8d', icon: PackageX },
  { label: 'Torre de Control', sub: 'Cockpit ejecutivo cross-área', href: '/dashboard/control-tower', keywords: 'torre de control control tower cockpit ejecutivo semaforo cross area resumen kpis vp operaciones', icon: RadioTower },
  { label: 'Mission Control', sub: 'Vista ejecutiva', href: '/dashboard/mission-control', keywords: 'mission control kpi ejecutivo metricas', icon: RadioTower },
  { label: 'Office', sub: 'Docs · Hojas · Slides', href: '/dashboard/office', keywords: 'office documentos hojas slides word excel', icon: FileText },
  { label: 'Axos ERP', sub: 'FIN · MM · PP · SD · T-Codes', href: '/dashboard/erp', keywords: 'erp tcode t-code fin mm pp sd sap', icon: Landmark },
  { label: 'ERP · Finanzas (FIN)', sub: 'Contabilidad', href: '/dashboard/erp/fin', keywords: 'erp fin contabilidad polizas cuentas', icon: Landmark },
  { label: 'ERP · Materiales (MM)', sub: 'Compras y valuación', href: '/dashboard/erp/mm', keywords: 'erp mm materiales compras po requisicion valuacion', icon: Boxes },
  { label: 'ERP · Producción (PP)', sub: 'MRP y órdenes', href: '/dashboard/erp/pp', keywords: 'erp pp mrp planeacion ordenes', icon: Factory },
  { label: 'ERP · Ventas (SD)', sub: 'Pedidos y facturas', href: '/dashboard/erp/sd', keywords: 'erp sd ventas pedidos facturas clientes', icon: DollarSign },
  { label: 'Usuarios y accesos', sub: 'Admin', href: '/dashboard/settings/users', keywords: 'usuarios users accesos roles permisos admin', icon: Users },
  { label: 'Organización', sub: 'Edificios · Clientes · Proyectos', href: '/dashboard/settings/organization', keywords: 'organizacion edificios clientes proyectos admin', icon: Building2 },
  { label: 'Aprobaciones', sub: 'Admin', href: '/dashboard/admin/approvals', keywords: 'aprobaciones approvals usuarios pendientes admin', icon: ShieldAlert },
  { label: 'Numeración de folios', sub: 'Admin · Datos maestros', href: '/dashboard/admin/numbering', keywords: 'folios numeracion secuencias consecutivos wo po ncr prefijo admin datos maestros', icon: Hash },
  // ── Piso de producción (shop floor) ──
  { label: 'Disposición de líneas', sub: 'Ing. Industrial · layout y balanceo', href: '/dashboard/line-engineering', keywords: 'disposicion lineas industrial ie layout estacion ruteo routing balanceo takt cycle cuello botella factor de uso poka yoke ayuda visual ctq changeover', icon: Gauge },
  { label: 'Muro del plan', sub: 'Planeación · publicar WOs en vivo', href: '/dashboard/production-plan', keywords: 'plan muro publicacion planeacion wo orden de trabajo work order liberar secuencia prioridad readiness adherencia operador autorizar acceso montado ejecucion', icon: Megaphone },
  { label: 'Surtido y e-kanban', sub: 'Materialista · montar kit a estación', href: '/dashboard/material-staging', keywords: 'surtido staging kitting materialista almacen montar material estacion kanban reposicion pull faltante shortage fill rate cola scanner llamado', icon: PackagePlus },
  { label: 'Calidad de piso · MRB', sub: 'Holds, disposición y where-used', href: '/dashboard/floor-quality', keywords: 'calidad piso hold retencion cuarentena mrb disposicion use as is rework repair scrap rtv scar sort ncr retrabajo reinspeccion where used genealogia contencion ppm', icon: ShieldX },
  { label: 'Torre de control de línea', sub: 'Readiness y semáforo por línea', href: '/dashboard/line-control-tower', keywords: 'torre control linea readiness plan vs real andon holds reposicion semaforo gerente operaciones turno oee adherencia cross linea', icon: RadioTower },
  { label: 'Chat', sub: 'Mensajería', href: '/dashboard/chat', keywords: 'chat mensajes mensajeria', icon: MessageSquare },
];

// ── Áreas: agrupan el catálogo de destinos para dar jerarquía visual y un color
// por sección (mismo lenguaje de "losetas" del hub: nunca íconos sobre gris plano).
type AreaKey = 'home' | 'production' | 'supply' | 'quality' | 'materials' | 'finance' | 'people' | 'comms' | 'erp' | 'admin';

/** Tono de marca de una loseta/encabezado: gradiente 135° (from→to) + sólido para sombra. */
interface Tone { from: string; to: string; solid: string }

/** Orden en que aparecen las áreas (vista inicial = catálogo completo, ordenado). */
const AREA_ORDER: AreaKey[] = ['home', 'production', 'supply', 'quality', 'materials', 'finance', 'people', 'comms', 'erp', 'admin'];

const AREA_META: Record<AreaKey, { label: string } & Tone> = {
  home:       { label: 'Inicio y tableros',              from: '#818cf8', to: '#6366f1', solid: '#6366f1' },
  production: { label: 'Planeación y producción',        from: '#ff9a66', to: '#ff7a45', solid: '#ff7a45' },
  supply:     { label: 'Almacén y cadena de suministro', from: '#ffc24d', to: '#f5a524', solid: '#f59e0b' },
  quality:    { label: 'Calidad',                        from: '#4ad991', to: '#2ec27e', solid: '#2ec27e' },
  materials:  { label: 'Materiales e ingeniería',        from: '#7c84ff', to: '#5b63e0', solid: '#5b63e0' },
  finance:    { label: 'Finanzas',                       from: '#34d1bf', to: '#0fb39a', solid: '#0fb39a' },
  people:     { label: 'Personas y soporte',             from: '#ff7db0', to: '#ff4d8d', solid: '#ff4d8d' },
  comms:      { label: 'Office y comunicación',          from: '#4aa3ff', to: '#0a84ff', solid: '#0a84ff' },
  erp:        { label: 'ERP · T-Codes',                  from: '#9a7bff', to: '#7c5cff', solid: '#7c5cff' },
  admin:      { label: 'Administración y datos',         from: '#94a3b8', to: '#64748b', solid: '#64748b' },
};

/** Tono neutro para el encabezado del bloque "Ir a un área" durante la búsqueda. */
const NAV_TONE: Tone = { from: '#94a3b8', to: '#64748b', solid: '#64748b' };

/** Clasifica un destino en su área por la ruta — mantiene DESTS intacto (cero riesgo de navegación). */
function areaFor(href: string): AreaKey {
  const p = href.replace('/dashboard', '') || '/';
  if (p.startsWith('/erp')) return 'erp';
  if (p === '/' || p === '/mission-control' || p === '/control-tower' || p === '/line-control-tower') return 'home';
  if (p === '/planning' || p === '/production' || p === '/operador' || p === '/production-plan' || p === '/line-engineering') return 'production';
  if (p === '/almacen' || p === '/inventory' || p === '/material-staging' || p === '/cycle-counts' || p === '/inbound' || p === '/outbound' || p === '/procurement') return 'supply';
  if (p === '/quality' || p === '/floor-quality' || p === '/test-engineering' || p === '/rma') return 'quality';
  if (p === '/models' || p === '/materials' || p === '/bom' || p === '/routing' || p === '/engineering' || p === '/backflush' || p === '/mrp' || p === '/tooling') return 'materials';
  if (p === '/finance' || p.startsWith('/finance/') || p === '/fixed-assets' || p === '/expenses') return 'finance';
  if (p === '/skills' || p === '/ehs' || p === '/maintenance' || p === '/legal' || p === '/improvement' || p === '/crm') return 'people';
  if (p === '/office' || p === '/chat') return 'comms';
  if (p === '/import' || p.startsWith('/settings') || p.startsWith('/admin')) return 'admin';
  return 'home';
}

// Shape shared by record hits (from searchSources) and navigation hits (from DESTS).
type RenderKind = SearchKind | 'nav';
interface RenderHit {
  kind: RenderKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  icon: React.ElementType;
  tone: Tone;
  area?: AreaKey;
  haystack?: string;
}

interface RenderGroup {
  key: string;
  kind: RenderKind;
  label: string;
  tone: Tone;
  items: RenderHit[];
}

// Etiqueta + ícono + tono por tipo de registro (área de resultados, lista para el backend).
const KIND_META: Record<RenderKind, { label: string; short: string; icon: React.ElementType } & Tone> = {
  wo:     { label: 'Órdenes de trabajo', short: 'Órdenes',    icon: Factory,       from: '#ff9a66', to: '#ff7a45', solid: '#ff7a45' },
  ncr:    { label: 'Calidad · NCR',      short: 'NCR',        icon: ShieldAlert,   from: '#fb7185', to: '#f43f5e', solid: '#f43f5e' },
  part:   { label: 'Partes y modelos',   short: 'Partes',     icon: Boxes,         from: '#7c84ff', to: '#5b63e0', solid: '#5b63e0' },
  person: { label: 'Personas',           short: 'Personas',   icon: Users,         from: '#ff7db0', to: '#ff4d8d', solid: '#ff4d8d' },
  doc:    { label: 'Documentos',         short: 'Documentos', icon: FileText,      from: '#aab2c0', to: '#7e8796', solid: '#7e8796' },
  nav:    { label: 'Ir a un área',       short: 'Áreas',      icon: CornerDownLeft, from: '#94a3b8', to: '#64748b', solid: '#64748b' },
};

/** Cuántos destinos de navegación se muestran durante una búsqueda (la vista inicial los muestra todos). */
const NAV_CAP = 8;

const RECENTS_KEY = 'axos_search_recent_hrefs';
const RECENTS_LIMIT = 6;

function readRecentHrefs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((href): href is string => typeof href === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecentHrefs(hrefs: string[]) {
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(hrefs.slice(0, RECENTS_LIMIT)));
  } catch {
    // Storage can be unavailable in private mode; navigation must still work.
  }
}

type SearchStatus = 'idle' | 'loading' | 'ready';
interface SearchState {
  hits: SearchHit[];
  status: SearchStatus;
  degraded: SearchKind[];
  authError: boolean;
}
const EMPTY_SEARCH: SearchState = { hits: [], status: 'idle', degraded: [], authError: false };

/** Id de DOM seguro para `aria-activedescendant` a partir del id del hit. */
const optId = (id: string) => 'axos-opt-' + id.replace(/[^a-zA-Z0-9_-]/g, '-');

export function SearchPalette() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [recentHrefs, setRecentHrefs] = useState(readRecentHrefs);

  // Record search (WO / NCR / parts / people / docs) — held in one atom that is
  // only ever written from async callbacks, so the effect never setStates
  // synchronously (avoids cascading renders).
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const { hits: entityHits, status, degraded, authError } = search;

  useEffect(() => {
    const reset = () => { setQuery(''); setSelected(0); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        reset();
        setIsOpen((o) => !o);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onOpen = () => { reset(); setIsOpen(true); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('axos:open-search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('axos:open-search', onOpen);
    };
  }, []);

  // Bloquea el scroll del fondo mientras la paleta está abierta.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ── Cross-entity search: debounce, then load (cached) index and filter ──────
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      // Defer the reset so it doesn't run synchronously inside the effect body.
      const t = setTimeout(() => setSearch(EMPTY_SEARCH), 0);
      return () => clearTimeout(t);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setSearch((s) => ({ ...s, status: 'loading' }));
      ensureSearchIndex(ctrl.signal)
        .then((idx) => {
          if (ctrl.signal.aborted) return;
          setSearch({ hits: filterSearchIndex(idx, q), status: 'ready', degraded: idx.degraded, authError: idx.authError });
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setSearch({ hits: [], status: 'ready', degraded: [], authError: true });
        });
    }, 180);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [query, isOpen]);

  const q = query.trim();
  const searching = q.length > 0;
  const terms = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q]);

  // Catálogo de navegación normalizado una sola vez (con su área, tono y haystack).
  const allNav = useMemo<RenderHit[]>(() =>
    DESTS.map((d) => {
      const area = areaFor(d.href);
      return {
        kind: 'nav' as const,
        id: `nav:${d.href}`,
        title: d.label,
        subtitle: d.sub,
        href: d.href,
        icon: d.icon,
        tone: AREA_META[area],
        area,
        haystack: `${d.label} ${d.sub} ${d.keywords}`.toLowerCase(),
      };
    }), []);

  // Grupos a renderizar (y orden de navegación con teclado):
  //  • sin query  → todo el catálogo agrupado por área (jerarquía clara)
  //  • con query  → "Ir a un área" (destinos que matchean) + registros por tipo
  const groups = useMemo<RenderGroup[]>(() => {
    const out: RenderGroup[] = [];
    if (!terms.length) {
      const recentItems = recentHrefs
        .map((href) => allNav.find((d) => d.href === href))
        .filter((item): item is RenderHit => Boolean(item));
      if (recentItems.length) {
        out.push({ key: 'recent', kind: 'nav', label: 'Recientes', tone: NAV_TONE, items: recentItems });
      }
      for (const area of AREA_ORDER) {
        const items = allNav.filter((d) => d.area === area);
        if (items.length) out.push({ key: `area:${area}`, kind: 'nav', label: AREA_META[area].label, tone: AREA_META[area], items });
      }
      return out;
    }
    const navHits = allNav.filter((d) => terms.every((t) => d.haystack!.includes(t))).slice(0, NAV_CAP);
    if (navHits.length) out.push({ key: 'nav', kind: 'nav', label: KIND_META.nav.label, tone: NAV_TONE, items: navHits });
    if (q.length >= 2) {
      for (const k of ENTITY_ORDER) {
        const items = entityHits
          .filter((h) => h.kind === k)
          .map<RenderHit>((h) => ({ kind: h.kind, id: h.id, title: h.title, subtitle: h.subtitle, href: h.href, badge: h.badge, icon: KIND_META[h.kind].icon, tone: KIND_META[h.kind] }));
        if (items.length) out.push({ key: `rec:${k}`, kind: k, label: KIND_META[k].label, tone: KIND_META[k], items });
      }
    }
    return out;
  }, [terms, allNav, recentHrefs, entityHits, q]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const indexById = useMemo(() => new Map(flat.map((h, i) => [h.id, i])), [flat]);
  const sel = flat.length ? Math.max(0, Math.min(selected, flat.length - 1)) : -1;

  const go = useCallback((href: string) => {
    setRecentHrefs((prev) => {
      const next = [href, ...prev.filter((item) => item !== href)].slice(0, RECENTS_LIMIT);
      writeRecentHrefs(next);
      return next;
    });
    setIsOpen(false);
    router.push(href);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = flat.length;
    // Base movement on the clamped `sel` (not raw `selected`) so a shrunk list can't jump.
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) setSelected((Math.max(sel, 0) + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) setSelected((Math.max(sel, 0) - 1 + n) % n); }
    else if (e.key === 'Home') { e.preventDefault(); setSelected(0); }
    else if (e.key === 'End') { e.preventDefault(); if (n) setSelected(n - 1); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); go(flat[sel].href); }
  };

  // Keep the highlighted row in view as the user arrows through groups.
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  // Estado del área de registros (honesto: refleja si la búsqueda de registros pudo
  // siquiera ejecutarse). Hoy no hay backend → normalmente "aún no conectada".
  const recordsLoading = q.length >= 2 && status !== 'ready';
  const recordHitCount = entityHits.length;
  const showRecordsSlot = q.length >= 2 && !(status === 'ready' && recordHitCount > 0);
  const hasNavMatch = !searching || groups.some((g) => g.kind === 'nav' && g.items.length > 0);
  const activeId = sel >= 0 && flat[sel] ? optId(flat[sel].id) : undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar y navegar"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.975 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-black/[0.07] dark:border-white/10 ring-1 ring-black/[0.03]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera: ícono + input + spinner + ESC */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.06] dark:border-white/10">
              <Search className="w-5 h-5 text-primary flex-shrink-0" strokeWidth={1.9} />
              <input
                autoFocus
                role="combobox"
                aria-expanded
                aria-controls="axos-search-listbox"
                aria-activedescendant={activeId}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                onKeyDown={onKeyDown}
                placeholder="Ir a un área o pantalla…  Planeación, Calidad, Almacén, ERP"
                className="flex-1 bg-transparent outline-none text-base text-foreground placeholder:text-gray-400"
              />
              {recordsLoading && <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
              <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400">ESC</kbd>
            </div>

            {/* Resultados */}
            <div id="axos-search-listbox" role="listbox" aria-label="Resultados" className="max-h-[58vh] overflow-y-auto p-2">
              {/* Pista honesta en la vista inicial: hoy esto navega; la búsqueda de registros llegará después. */}
              {!searching && (
                <p className="px-3 pt-1.5 pb-2 text-[11.5px] text-gray-400">
                  Salta a cualquier área. La búsqueda de órdenes, NCR y partes llegará pronto.
                </p>
              )}

              {groups.map((group) => (
                <div key={group.key} className="mb-1.5 last:mb-0">
                  <GroupHeader label={group.label} tone={group.tone} count={group.items.length} />
                  {group.items.map((item) => {
                    const i = indexById.get(item.id) ?? -1;
                    const active = i === sel;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        id={optId(item.id)}
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        ref={active ? selectedRef : undefined}
                        onMouseMove={() => { if (!active) setSelected(i); }}
                        onClick={() => go(item.href)}
                        className={`group/row w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${
                          active
                            ? 'bg-primary/[0.09] dark:bg-primary/[0.12] ring-1 ring-inset ring-primary/25 dark:ring-primary/20'
                            : 'hover:bg-black/[0.035] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <Tile tone={item.tone} icon={Icon} active={active} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-medium text-foreground truncate">
                            {highlight(item.title, terms)}
                          </span>
                          {item.subtitle && (
                            <span className="block text-[11.5px] text-gray-500 dark:text-gray-400 truncate">{item.subtitle}</span>
                          )}
                        </span>
                        {item.badge && (
                          <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400 flex-shrink-0 capitalize">
                            {item.badge.replace(/_/g, ' ').toLowerCase()}
                          </span>
                        )}
                        <span className={`flex-shrink-0 items-center gap-1 text-[10px] font-semibold text-primary ${active ? 'flex' : 'hidden'}`}>
                          <CornerDownLeft className="w-3 h-3" />
                          <span className="hidden md:inline">Enter</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Sin áreas que coincidan (pero el slot de registros sigue presente abajo). */}
              {searching && !hasNavMatch && (
                <p className="px-3 py-2 text-[12.5px] text-gray-500 dark:text-gray-400">
                  Ninguna área coincide con «{q}».
                </p>
              )}

              {/* Área de resultados de registros: diseñada y lista para cuando llegue el backend. */}
              {showRecordsSlot && (
                <RecordsSlot q={q} loading={recordsLoading} authError={authError} degraded={degraded} />
              )}

              {/* Aviso honesto cuando algunas fuentes responden y otras no. */}
              {searching && status === 'ready' && recordHitCount > 0 && degraded.length > 0 && (
                <p className="px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                  No se pudo consultar: {degraded.map((k) => KIND_META[k].label).join(', ')}. Mostrando el resto.
                </p>
              )}
            </div>

            {/* Pie: atajos de teclado + nota de T-Codes */}
            <div className="px-4 py-2.5 border-t border-black/5 dark:border-white/10 flex items-center gap-3 text-[11px] text-gray-400">
              <FooterKey k="↑↓" label="navegar" />
              <FooterKey k="↵" label="abrir" />
              <FooterKey k="esc" label="cerrar" />
              <span className="ml-auto hidden sm:inline">¿T-Codes? Entra a <span className="text-gray-500 dark:text-gray-300 font-medium">Axos ERP</span></span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Encabezado de grupo: punto de color del área + etiqueta + conteo. */
function GroupHeader({ label, tone, count }: { label: string; tone: Tone; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2 pb-1">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tone.solid }} />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-[11px] font-normal text-gray-300 dark:text-gray-600">{count}</span>
    </div>
  );
}

/** Loseta squircle con gradiente del dominio (lenguaje visual del hub: nunca gris plano). */
function Tile({ tone, icon: Icon, active }: { tone: Tone; icon: React.ElementType; active: boolean }) {
  return (
    <span
      aria-hidden
      className="grid place-items-center w-9 h-9 rounded-[11px] flex-shrink-0"
      style={{
        background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`,
        boxShadow: active
          ? `0 5px 14px ${tone.solid}66, inset 0 1px 0 rgba(255,255,255,.35)`
          : `0 2px 7px ${tone.solid}33, inset 0 1px 0 rgba(255,255,255,.3)`,
      }}
    >
      <Icon className="w-[18px] h-[18px] text-white" strokeWidth={1.9} />
    </span>
  );
}

/** Resalta los términos buscados dentro del título. */
function highlight(text: string, terms: string[]): React.ReactNode {
  const esc = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!esc.length) return text;
  const re = new RegExp(`(${esc.join('|')})`, 'ig');
  const parts = text.split(re);
  const set = new Set(terms);
  return parts.map((part, i) =>
    part && set.has(part.toLowerCase())
      ? <mark key={i} className="bg-transparent text-primary font-semibold">{part}</mark>
      : <Fragment key={i}>{part}</Fragment>,
  );
}

function FooterKey({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400 text-[10px]">{k}</kbd>
      <span>{label}</span>
    </span>
  );
}

/**
 * Slot de resultados de registros — diseñado y listo para cuando exista el backend
 * de búsqueda. Hoy navega-solo: el copy es honesto y refleja el estado real
 * (cargando / sin coincidencias / aún no conectada). Las "fichas fantasma" muestran
 * qué aparecerá aquí (órdenes, NCR, partes, personas, documentos).
 */
function RecordsSlot({ q, loading, authError, degraded }: { q: string; loading: boolean; authError: boolean; degraded: SearchKind[] }) {
  return (
    <div className="mt-1 mx-1 mb-1 rounded-2xl border border-dashed border-black/[0.1] dark:border-white/[0.12] bg-black/[0.015] dark:bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Registros</span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
      </div>

      {loading ? (
        <div className="space-y-1.5" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-[11px] bg-black/[0.06] dark:bg-white/[0.07] animate-pulse flex-shrink-0" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-2.5 w-2/5 rounded bg-black/[0.06] dark:bg-white/[0.07] animate-pulse" />
                <span className="block h-2 w-3/5 rounded bg-black/[0.05] dark:bg-white/[0.05] animate-pulse" />
              </span>
            </div>
          ))}
        </div>
      ) : authError ? (
        <p className="text-[12.5px] leading-snug text-gray-500 dark:text-gray-400">
          La búsqueda de registros aún no está conectada. Aparecerá aquí en cuanto el backend esté listo.
        </p>
      ) : (
        <p className="text-[12.5px] leading-snug text-gray-500 dark:text-gray-400">
          Sin registros que coincidan con «{q}».
          {degraded.length > 0 && ` No se pudo consultar: ${degraded.map((k) => KIND_META[k].label).join(', ')}.`}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {ENTITY_ORDER.map((k) => {
          const m = KIND_META[k];
          const Icon = m.icon;
          return (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10.5px] font-medium text-gray-500 dark:text-gray-400 bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.06]"
            >
              <Icon className="w-3 h-3" style={{ color: m.solid }} />
              {m.short}
            </span>
          );
        })}
      </div>
    </div>
  );
}
