'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutGrid, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import { glass } from '@/lib/glass';
import { isAdminAccess, seesAllAreas } from '@/lib/owner';
import { AREAS, SECTION_ORDER, type DashboardArea } from '@/lib/dashboardAreas';
import { DOMAINS, ICON_STROKE, domainTile } from '@/lib/design/domains';
import { useDashboardSession } from '@/hooks/useDashboardSession';

/**
 * Desktop command rail for the AXOS dashboard shell.
 *
 * It reuses the same module registry as the hub, wayfinding and mobile dock
 * (`AREAS`) so desktop gets a premium domain navigation surface without adding a
 * parallel shell or a second navigation source. Mobile remains owned by
 * `DashboardDock`; this rail is hidden below `md`.
 */
export function DashboardCommandRail() {
  const pathname = usePathname() || '';
  const { session } = useDashboardSession();
  const [collapsed, setCollapsed] = useState(false);

  const role = session?.role || '';
  const seesAll = seesAllAreas(session?.role, session?.email);
  const isAdmin = isAdminAccess(session?.role, session?.email);

  const sections = useMemo(() => {
    const visible = AREAS.filter((area) => seesAll || area.roles.includes(role));
    return SECTION_ORDER.map((section) => ({
      section,
      areas: visible.filter((area) => area.section === section),
    })).filter((group) => group.areas.length > 0);
  }, [role, seesAll]);

  const active = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      aria-label="Navegación principal por dominios"
      className={`${glass} fixed bottom-6 left-4 top-24 z-40 hidden flex-col overflow-hidden rounded-[2rem] border border-white/55 shadow-[0_18px_60px_-34px_rgba(15,23,42,.55)] ring-1 ring-slate-950/[0.04] transition-[width] duration-300 md:flex ${
        collapsed ? 'w-[5.25rem]' : 'w-72'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/5 px-3 py-3 dark:border-white/10">
        <Link
          href="/dashboard"
          aria-label="Inicio"
          title="Inicio"
          className={`flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            active('/dashboard')
              ? 'bg-foreground text-background'
              : 'text-foreground hover:bg-foreground/[0.06] dark:hover:bg-white/10'
          }`}
        >
          <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl ${active('/dashboard') ? 'bg-background/15' : 'bg-foreground/[0.06]'}`}>
            <LayoutGrid className="h-5 w-5" strokeWidth={ICON_STROKE} />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">AXOS Hub</span>
              <span className={`block truncate text-[11px] ${active('/dashboard') ? 'text-background/70' : 'text-muted-foreground'}`}>
                Command center
              </span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expandir navegación lateral' : 'Colapsar navegación lateral'}
          aria-pressed={collapsed}
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/10"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {sections.map(({ section, areas }) => (
            <div key={section}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {section}
                </p>
              )}
              <div className="space-y-1">
                {areas.map((area) => (
                  <RailLink key={area.href} area={area} active={active(area.href)} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {isAdmin && (
        <div className="border-t border-black/5 p-3 dark:border-white/10">
          <Link
            href="/dashboard/settings/organization"
            aria-label="Ajustes"
            title="Ajustes"
            className={`flex items-center gap-3 rounded-2xl px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              active('/dashboard/settings')
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground dark:hover:bg-white/10'
            }`}
          >
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-foreground/[0.06]">
              <Settings className="h-5 w-5" strokeWidth={ICON_STROKE} />
            </span>
            {!collapsed && <span>Ajustes</span>}
          </Link>
        </div>
      )}
    </aside>
  );
}

function RailLink({ area, active, collapsed }: { area: DashboardArea; active: boolean; collapsed: boolean }) {
  const Icon = area.icon;
  const domain = DOMAINS[area.domain];

  return (
    <Link
      href={area.href}
      title={collapsed ? `${area.name} · ${domain.label}` : area.name}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-2xl px-2 py-2 transition-[background-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'text-foreground hover:-translate-y-0.5 hover:bg-foreground/[0.06] dark:hover:bg-white/10'
      }`}
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl text-white" style={domainTile(area.domain)}>
        <Icon className="h-5 w-5" strokeWidth={ICON_STROKE} />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{area.name}</span>
          <span className={`block truncate text-[11px] ${active ? 'text-background/70' : 'text-muted-foreground'}`}>
            {domain.label} · {area.desc}
          </span>
        </span>
      )}
    </Link>
  );
}
