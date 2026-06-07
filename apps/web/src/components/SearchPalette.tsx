'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, LayoutGrid, LineChart, Warehouse, Boxes, Factory, HardHat, ShieldCheck,
  Cpu, DollarSign, Calculator, RadioTower, FileText, Landmark, Users, Building2,
  ShieldAlert, MessageSquare, CornerDownLeft, Hash, Lightbulb, Wrench, Scale, FlaskConical, ShoppingCart, GraduationCap, Truck, PackageCheck, ClipboardList, Target, Building, Receipt, Hammer, PackageX,
  Gauge, Megaphone, PackagePlus, ScanLine,
} from 'lucide-react';

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
  { label: 'Chat', sub: 'Mensajería', href: '/dashboard/chat', keywords: 'chat mensajes mensajeria', icon: MessageSquare },
];

export function SearchPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTS;
    const terms = q.split(/\s+/);
    return DESTS.filter((d) => {
      const hay = `${d.label} ${d.sub} ${d.keywords}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [query]);

  const go = useCallback((href: string) => {
    setIsOpen(false);
    router.push(href);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((p) => Math.min(p + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((p) => Math.max(p - 1, 0)); }
    else if (e.key === 'Enter' && results[selected]) { e.preventDefault(); go(results[selected].href); }
  };

  if (!isOpen) return null;

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
            placeholder="Buscar o ir a… (áreas, ERP, ajustes)"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-gray-400"
          />
          <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400">ESC</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">Sin resultados. Prueba otro término.</div>
          ) : (
            results.map((d, i) => (
              <button
                key={d.href}
                onMouseEnter={() => setSelected(i)}
                onClick={() => go(d.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors ${i === selected ? 'bg-black/5 dark:bg-white/10' : ''}`}
              >
                <span className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/10 grid place-items-center flex-shrink-0">
                  <d.icon className="w-4.5 h-4.5 text-gray-600 dark:text-gray-300" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{d.label}</span>
                  <span className="block text-[11px] text-gray-400 truncate">{d.sub}</span>
                </span>
                {i === selected && <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
              </button>
            ))
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
