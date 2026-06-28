'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { glass } from '@/lib/glass';
import { seesAllAreas } from '@/lib/owner';
import { AREAS, type DashboardArea } from '@/lib/dashboardAreas';
import { useDashboardSession } from '@/hooks/useDashboardSession';
import { BARE_PREFIXES } from '@/lib/routeChrome';

/**
 * Tira de wayfinding del shell del dashboard. Montada UNA vez en DashboardShell,
 * da a las ~87 páginas /dashboard/* una miga consistente, un control "subir un
 * nivel" y un salto a áreas hermanas de la misma sección, respetando el filtrado
 * por rol del hub (con el acceso de admin/owner blindado vía seesAllAreas).
 *
 * Lee la sesión con el MISMO patrón ligero que el hub/TopBar/Dock
 * (fetch /api/auth/me → d.session), porque el filtrado de hermanas debe espejar
 * EXACTAMENTE la lógica del hub (session.role / session.email). Un SessionContext
 * compartido sobre /api/auth/me sería un buen refactor posterior — fuera de
 * alcance aquí. (No se usa AuthContext/useAuth: es otro modelo de sesión —token
 * de backend, roles[]— que podría divergir del gate del hub.)
 */

// Las rutas "bare" se comparten con el shell desde la Shell Taxonomy
// (`@/lib/routeChrome`) para no duplicar la lista.

// Overrides para que los segmentos sin área lean bien en español.
const SEGMENT_LABELS: Record<string, string> = {
  notifications: 'Notificaciones',
  settings: 'Ajustes',
  admin: 'Administración',
  approvals: 'Aprobaciones',
  users: 'Usuarios',
  organization: 'Organización',
  permissions: 'Permisos',
  numbering: 'Numeración',
};

/** ¿El segmento parece un id (numérico o uuid)? Para no mostrarlo crudo. */
function isIdSegment(seg: string): boolean {
  return (
    /^\d+$/.test(seg) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)
  );
}

/** Humaniza un segmento de ruta: override → "Detalle" si es id → Título. */
function humanizeSegment(seg: string): string {
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  if (isIdSegment(seg)) return 'Detalle';
  const spaced = decodeURIComponent(seg).replace(/[-_]+/g, ' ').trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

type Crumb = {
  key: string;
  label: string;
  href?: string;
  kind: 'home' | 'section' | 'area' | 'segment';
};

/** Menú de áreas hermanas (mismo section), navegable por teclado y con Esc. */
function SectionDropdown({
  label,
  siblings,
  currentHref,
  reduce,
}: {
  label: string;
  siblings: DashboardArea[];
  currentHref?: string;
  reduce: boolean | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLAnchorElement>('[data-menuitem]') ?? [],
        );
        if (!items.length) return;
        const idx = items.indexOf(document.activeElement as HTMLAnchorElement);
        const next =
          e.key === 'ArrowDown'
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Foco al primer ítem al abrir (patrón de menú accesible).
  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLAnchorElement>('[data-menuitem]');
    first?.focus();
  }, [open]);

  // Sin hermanas (sesión sin cargar o rol sin acceso): miga simple, sin menú.
  if (siblings.length === 0) {
    return <span className="text-gray-500 dark:text-gray-400">{label}</span>;
  }

  return (
    <div ref={ref} className="relative flex min-w-0 items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-w-0 max-w-[40vw] items-center gap-0.5 rounded-md px-1 text-gray-500 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:text-primary sm:max-w-none"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={`Áreas de ${label}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-56 overflow-y-auto rounded-2xl border border-border bg-white p-1.5 shadow-xl dark:bg-slate-900"
          >
            {siblings.map((s) => {
              const active = s.href === currentHref;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  role="menuitem"
                  data-menuitem
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">{s.name}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardWayfinding() {
  const rawPathname = usePathname() || '';
  // Normaliza una eventual barra final (defensa) sin tocar la raíz.
  const pathname =
    rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '') : rawPathname;
  const reduce = useReducedMotion();
  const { session } = useDashboardSession();

  // Área cuyo href es el prefijo (por segmento) MÁS LARGO que coincide.
  const area = useMemo<DashboardArea | null>(() => {
    let best: DashboardArea | null = null;
    for (const a of AREAS) {
      if (pathname === a.href || pathname.startsWith(a.href + '/')) {
        if (!best || a.href.length > best.href.length) best = a;
      }
    }
    return best;
  }, [pathname]);

  // En el hub exacto y en las páginas bare no hay tira (tras los hooks).
  const hidden =
    pathname === '/dashboard' || BARE_PREFIXES.some((p) => pathname.startsWith(p));
  if (hidden) return null;

  // ── Construir migas + el padre para "subir" ──
  const crumbs: Crumb[] = [{ key: 'home', label: 'Inicio', href: '/dashboard', kind: 'home' }];
  let parentHref = '/dashboard';

  if (area) {
    crumbs.push({ key: 'section', label: area.section, kind: 'section' });
    crumbs.push({ key: 'area', label: area.name, href: area.href, kind: 'area' });
    const deeper = pathname.slice(area.href.length).split('/').filter(Boolean);
    deeper.forEach((seg, i) =>
      crumbs.push({ key: `seg-${i}-${seg}`, label: humanizeSegment(seg), kind: 'segment' }),
    );
    // Padre = área si estás en un sub-segmento; si no, casa.
    parentHref = deeper.length > 0 ? area.href : '/dashboard';
  } else {
    // Sin área: humaniza cada segmento tras /dashboard. Sin rutas intermedias
    // conocidas, "subir" vuelve a casa (no inventamos rutas que podrían 404).
    const segs = pathname.split('/').filter(Boolean).slice(1);
    segs.forEach((seg, i) =>
      crumbs.push({ key: `seg-${i}-${seg}`, label: humanizeSegment(seg), kind: 'segment' }),
    );
    parentHref = '/dashboard';
  }

  const lastIdx = crumbs.length - 1;

  // Hermanas role-aware: REUSA la lógica EXACTA del hub. Admin/owner ve todas.
  const seesAll = seesAllAreas(session?.role, session?.email);
  const siblings = area
    ? AREAS.filter(
        (a) => a.section === area.section && (seesAll || a.roles.includes(session?.role || '')),
      )
    : [];

  // Colapso en móvil: ocultamos las migas intermedias (área + sub-segmentos
  // previos al actual) tras una elipsis; Inicio, la sección y la miga actual se
  // mantienen. El dropdown de sección sigue accesible.
  const isCollapsible = (c: Crumb, i: number) =>
    i !== lastIdx && c.kind !== 'home' && c.kind !== 'section';
  const firstCollapsibleIdx = crumbs.findIndex((c, i) => isCollapsible(c, i));
  const hasCollapsed = firstCollapsibleIdx !== -1;

  const sep = (
    <ChevronRight
      aria-hidden
      className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 dark:text-gray-600"
    />
  );

  return (
    <div className="px-6 pt-3 pb-1 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <nav
          aria-label="Ruta de navegación"
          className={`${glass} flex items-center gap-1.5 rounded-2xl px-2 py-1.5 text-xs sm:text-sm`}
        >
          {/* Subir un nivel — navega al padre derivado de la miga (no router.back). */}
          <Link
            href={parentHref}
            aria-label="Subir un nivel"
            title="Subir un nivel"
            className="flex-shrink-0 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-black/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>

          <span aria-hidden className="h-4 w-px flex-shrink-0 bg-black/10 dark:bg-white/10" />

          <ol className="flex min-w-0 flex-1 items-center gap-1.5">
            {crumbs.map((c, i) => {
              const isLast = i === lastIdx;
              return (
                <React.Fragment key={c.key}>
                  {/* Elipsis de colapso (solo móvil), donde empiezan las ocultas. */}
                  {hasCollapsed && i === firstCollapsibleIdx && (
                    <li aria-hidden className="flex flex-shrink-0 items-center gap-1.5 sm:hidden">
                      {sep}
                      <span className="px-0.5 text-gray-400 dark:text-gray-500">…</span>
                    </li>
                  )}
                  <li
                    className={`items-center gap-1.5 ${
                      isLast ? 'flex min-w-0' : 'flex-shrink-0'
                    } ${isCollapsible(c, i) ? 'hidden sm:flex' : 'flex'}`}
                  >
                    {i > 0 && sep}
                    {c.kind === 'section' ? (
                      <SectionDropdown
                        label={c.label}
                        siblings={siblings}
                        currentHref={area?.href}
                        reduce={reduce}
                      />
                    ) : isLast ? (
                      <span
                        aria-current="page"
                        className="truncate font-medium text-foreground"
                      >
                        {c.label}
                      </span>
                    ) : c.href ? (
                      <Link
                        href={c.href}
                        className="rounded-md px-0.5 text-gray-500 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400 dark:hover:text-primary"
                      >
                        {c.label}
                      </Link>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">{c.label}</span>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
