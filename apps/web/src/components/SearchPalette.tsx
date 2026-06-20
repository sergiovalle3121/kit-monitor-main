'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, LayoutGrid, LineChart, Warehouse, Boxes, Factory, HardHat, ShieldCheck,
  Cpu, DollarSign, Calculator, RadioTower, FileText, Landmark, Users, Building2,
  ShieldAlert, MessageSquare, CornerDownLeft, Hash, Lightbulb, Wrench, Scale, FlaskConical, ShoppingCart, GraduationCap, Truck, PackageCheck, ClipboardList, Target, Building, Receipt, Hammer, PackageX, Package,
  Gauge, Megaphone, PackagePlus, ScanLine, ShieldX, Loader2, Network, Workflow,
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
  { label: 'Modelos · NPI', sub: 'Maestro de productos', href: '/dashboard/models', keywords: 'modelos modelo producto productos npi master maestro mdl numero de parte folio nuevo modelo', icon: Boxes },
  { label: 'Maestro de Materiales', sub: 'Partes · AVL · alternantes', href: '/dashboard/materials', keywords: 'materiales material maestro parte partes mm avl fabricante mpn alternante sustituto comprado fabricado phantom uom make buy numero de parte mat', icon: Package },
  { label: 'BOM Multinivel', sub: 'Estructura · explosión · where-used', href: '/dashboard/bom', keywords: 'bom estructura producto multinivel explosion explotar where used donde se usa ensamble subensamble componentes lista de materiales arbol niveles', icon: Network },
  { label: 'Ruteo de Manufactura', sub: 'Operaciones · tiempos · centro de trabajo', href: '/dashboard/routing', keywords: 'ruteo routing ruta proceso operaciones secuencia centro de trabajo work center tiempo estandar setup run backflush consumo manufactura rt', icon: Workflow },
  { label: 'Ingeniería', sub: 'BOM y proceso', href: '/dashboard/engineering', keywords: 'ingenieria engineering bom ruta proceso npi', icon: Cpu },
  { label: 'Finanzas', sub: 'Costos y P&L', href: '/dashboard/finance', keywords: 'finanzas finance costos dinero movimientos', icon: DollarSign },
  { label: 'Costeo por orden', sub: 'Cost rollup', href: '/dashboard/finance/cost-rollup', keywords: 'costo costeo rollup wo mano de obra material', icon: Calculator },
  { label: 'Mejora continua', sub: 'Kaizen · Lean · 6σ', href: '/dashboard/improvement', keywords: 'mejora continua kaizen lean six sigma opex ahorros iniciativas 5s', icon: Lightbulb },
  { label: 'EHS · Seguridad', sub: 'Incidentes y casi-accidentes', href: '/dashboard/ehs', keywords: 'ehs seguridad medio ambiente incidentes casi accidente near miss safety lesiones recordable', icon: ShieldAlert },
  { label: 'Mantenimiento · TPM', sub: 'Activos y órdenes (CMMS)', href: '/dashboard/maintenance', keywords: 'mantenimiento tpm cmms activos equipos ordenes preventivo correctivo mtbf mttr averias paros', icon: Wrench },
  { label: 'Legal · Contratos', sub: 'Contratos y vencimientos', href: '/dashboard/legal', keywords: 'legal contratos compliance vencimiento renovacion nda proveedor cliente acuerdos', icon: Scale },
  { label: 'Test Engineering', sub: 'Yields y Pareto de fallas', href: '/dashboard/test-engineering', keywords: 'test engineering pruebas yield fpy first pass rendimiento pareto fallas ict fct aoi ensayo', icon: FlaskConical },
  { label: 'Compras · Procurement', sub: 'Órdenes de compra y OTD', href: '/dashboard/procurement', keywords: 'compras procurement po orden de compra proveedor sourcing otd recepcion purchasing', icon: ShoppingCart },
  { label: 'RH · Skills', sub: 'Certificaciones y matriz', href: '/dashboard/skills', keywords: 'rh skills habilidades certificaciones matriz capacitacion recertificacion empleados ipc esd', icon: GraduationCap },
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
  { label: 'Terminal de operador', sub: 'Producción · ejecutar en estación', href: '/dashboard/operator-terminal', keywords: 'terminal operador ejecucion estacion escanear poka yoke backflush consumo confirmar serial genealogia andon defecto takt skill certificado bloqueo faltante hora por hora', icon: ScanLine },
  { label: 'Calidad de piso · MRB', sub: 'Holds, disposición y where-used', href: '/dashboard/floor-quality', keywords: 'calidad piso hold retencion cuarentena mrb disposicion use as is rework repair scrap rtv scar sort ncr retrabajo reinspeccion where used genealogia contencion ppm', icon: ShieldX },
  { label: 'Torre de control de línea', sub: 'Readiness y semáforo por línea', href: '/dashboard/line-control-tower', keywords: 'torre control linea readiness plan vs real andon holds reposicion semaforo gerente operaciones turno oee adherencia cross linea', icon: RadioTower },
  { label: 'Chat', sub: 'Mensajería', href: '/dashboard/chat', keywords: 'chat mensajes mensajeria', icon: MessageSquare },
];

// Shape shared by record hits (from searchSources) and navigation hits (from DESTS).
type RenderKind = SearchKind | 'nav';
interface RenderHit {
  kind: RenderKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  icon?: React.ElementType;
}

// Label + fallback icon per group. Records first, navigation ("Ir a…") last.
const KIND_META: Record<RenderKind, { label: string; icon: React.ElementType }> = {
  wo: { label: 'Órdenes de trabajo', icon: Factory },
  ncr: { label: 'Calidad · NCR', icon: ShieldAlert },
  part: { label: 'Partes y modelos', icon: Boxes },
  person: { label: 'Personas', icon: Users },
  doc: { label: 'Documentos', icon: FileText },
  nav: { label: 'Ir a…', icon: CornerDownLeft },
};

type SearchStatus = 'idle' | 'loading' | 'ready';
interface SearchState {
  hits: SearchHit[];
  status: SearchStatus;
  degraded: SearchKind[];
  authError: boolean;
}
const EMPTY_SEARCH: SearchState = { hits: [], status: 'idle', degraded: [], authError: false };

export function SearchPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

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

  const searching = query.trim().length > 0;

  // Navigation hits from the static destination catalog (synchronous, instant).
  const navHits = useMemo<RenderHit[]>(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const base = !q
      ? DESTS
      : DESTS.filter((d) => {
          const hay = `${d.label} ${d.sub} ${d.keywords}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        });
    const mapped: RenderHit[] = base.map((d) => ({
      kind: 'nav', id: `nav:${d.href}`, title: d.label, subtitle: d.sub, href: d.href, icon: d.icon,
    }));
    return searching ? mapped.slice(0, 8) : mapped;
  }, [query, searching]);

  // Display groups: records first (in ENTITY_ORDER), navigation appended last.
  const groups = useMemo(() => {
    const defs: { kind: RenderKind; label: string; icon: React.ElementType; items: RenderHit[] }[] = [];
    // Records only matter once the query is long enough to have triggered a search;
    // gating here keeps any stale hits from a previous query off-screen.
    if (query.trim().length >= 2) {
      for (const k of ENTITY_ORDER) {
        const items = entityHits.filter((h) => h.kind === k);
        if (items.length) defs.push({ kind: k, label: KIND_META[k].label, icon: KIND_META[k].icon, items });
      }
    }
    if (navHits.length) defs.push({ kind: 'nav', label: KIND_META.nav.label, icon: KIND_META.nav.icon, items: navHits });
    return defs;
  }, [entityHits, navHits, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const indexById = useMemo(() => new Map(flat.map((h, i) => [h.id, i])), [flat]);
  const sel = flat.length ? Math.max(0, Math.min(selected, flat.length - 1)) : -1;

  const go = useCallback((href: string) => {
    setIsOpen(false);
    router.push(href);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((p) => Math.min(p + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((p) => Math.max(p - 1, 0)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); go(flat[sel].href); }
  };

  // Keep the highlighted row in view as the user arrows through groups.
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  if (!isOpen) return null;

  const q = query.trim();
  const showLoading = searching && q.length >= 2 && status === 'loading' && entityHits.length === 0;
  const noResults = searching && flat.length === 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-xl mx-4 rounded-3xl overflow-hidden shadow-2xl bg-white/98 dark:bg-neutral-900/95 backdrop-blur-2xl border border-black/5 dark:border-white/10 ring-1 ring-black/[0.04]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.06] dark:border-white/10">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKeyDown}
            placeholder="Buscar órdenes, NCR, partes, personas, documentos… o ir a un área"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-gray-400"
          />
          {showLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
          <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400">ESC</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {noResults ? (
            <EmptyState q={q} short={q.length < 2} authError={authError} loading={showLoading} />
          ) : (
            <>
              {showLoading && (
                <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  Buscando en órdenes, calidad, inventario, personas y documentos…
                </div>
              )}

              {groups.map((group) => (
                <div key={group.kind} className="mb-1">
                  {searching && (
                    <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      <group.icon className="w-3 h-3" />
                      {group.label}
                      <span className="font-normal normal-case text-gray-300 dark:text-gray-600">· {group.items.length}</span>
                    </div>
                  )}
                  {group.items.map((item) => {
                    const i = indexById.get(item.id) ?? -1;
                    const Icon = item.icon ?? group.icon;
                    return (
                      <button
                        key={item.id}
                        ref={i === sel ? selectedRef : undefined}
                        onMouseEnter={() => setSelected(i)}
                        onClick={() => go(item.href)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${i === sel ? 'bg-black/5 dark:bg-white/10' : ''}`}
                      >
                        <span className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 grid place-items-center flex-shrink-0">
                          <Icon className="w-4.5 h-4.5 text-gray-600 dark:text-gray-300" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{item.title}</span>
                          {item.subtitle && <span className="block text-[11px] text-gray-400 truncate">{item.subtitle}</span>}
                        </span>
                        {item.badge && (
                          <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500 flex-shrink-0 capitalize">
                            {item.badge.replace(/_/g, ' ').toLowerCase()}
                          </span>
                        )}
                        {i === sel && <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}

              {searching && status === 'ready' && degraded.length > 0 && (
                <div className="px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                  No se pudo consultar: {degraded.map((k) => KIND_META[k].label).join(', ')}. Mostrando el resto.
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-black/5 dark:border-white/10 flex items-center gap-4 text-[11px] text-gray-400">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>esc cerrar</span>
          <span className="ml-auto">Para T-Codes, entra a Axos ERP</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ q, short, authError, loading }: { q: string; short: boolean; authError: boolean; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Buscando…
      </div>
    );
  }
  if (short) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-400">
        Escribe al menos 2 caracteres para buscar órdenes, NCR, partes, personas y documentos.
      </div>
    );
  }
  if (authError) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-400">
        No se pudo buscar. Revisa tu conexión o vuelve a iniciar sesión.
      </div>
    );
  }
  return (
    <div className="px-4 py-10 text-center text-sm text-gray-400">
      Sin resultados para «{q}». Prueba con un folio, número de parte, NCR o nombre.
    </div>
  );
}
