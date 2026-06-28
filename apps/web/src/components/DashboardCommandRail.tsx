"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  Settings,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { isAdminAccess, seesAllAreas } from "@/lib/owner";
import { AREAS, SECTION_ORDER, type DashboardArea } from "@/lib/dashboardAreas";
import { DOMAINS, ICON_STROKE } from "@/lib/design/domains";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import { useMemo, useState } from "react";

/**
 * Command rail desktop del dashboard. Reutiliza el catálogo `AREAS` y la misma
 * sesión/gating del hub, el dock móvil y wayfinding: no crea un segundo modelo
 * de navegación, solo una presentación lateral premium para pantallas grandes.
 */
export function DashboardCommandRail() {
  const pathname = usePathname() || "";
  const { session } = useDashboardSession();
  const [collapsed, setCollapsed] = useState(false);

  const role = session?.role || "";
  const seesAll = seesAllAreas(session?.role, session?.email);
  const isAdmin = isAdminAccess(session?.role, session?.email);

  const visibleAreas = useMemo(
    () => AREAS.filter((area) => seesAll || area.roles.includes(role)),
    [role, seesAll],
  );

  const groups = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        section,
        areas: visibleAreas.filter((area) => area.section === section),
      })).filter((group) => group.areas.length > 0),
    [visibleAreas],
  );

  const active = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      aria-label="Navegación principal por dominios"
      className="fixed left-4 top-24 z-40 hidden max-h-[calc(100vh-7rem)] lg:block"
    >
      <nav
        className={`${glass} flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-[2rem] border border-white/60 shadow-xl shadow-slate-950/5 transition-[width] duration-300 dark:border-white/10 ${
          collapsed ? "w-[5.25rem]" : "w-72"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-black/5 px-3 py-3 dark:border-white/10">
          <Link
            href="/dashboard"
            aria-label="Inicio AXOS"
            title="Inicio AXOS"
            className={`flex min-w-0 items-center gap-2 rounded-2xl px-2 py-2 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/10 ${
              active("/dashboard")
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl bg-foreground text-background shadow-sm">
              <LayoutGrid className="h-4.5 w-4.5" strokeWidth={ICON_STROKE} />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">
                  AXOS OS
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Command rail
                </span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={
              collapsed
                ? "Expandir navegación lateral"
                : "Colapsar navegación lateral"
            }
            aria-expanded={!collapsed}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/10"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <section key={group.section} className="mb-4 last:mb-1">
              {!collapsed && (
                <h2 className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {group.section}
                </h2>
              )}
              <div className="space-y-1">
                {group.areas.map((area) => (
                  <RailLink
                    key={area.href}
                    area={area}
                    active={active(area.href)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="border-t border-black/5 p-2 dark:border-white/10">
          <UtilityLink
            href="/dashboard/chat"
            label="Mensajes"
            active={active("/dashboard/chat")}
            collapsed={collapsed}
            icon={MessageSquare}
          />
          {isAdmin && (
            <UtilityLink
              href="/dashboard/settings/organization"
              label="Ajustes"
              active={active("/dashboard/settings")}
              collapsed={collapsed}
              icon={Settings}
            />
          )}
        </div>
      </nav>
    </aside>
  );
}

function RailLink({
  area,
  active,
  collapsed,
}: {
  area: DashboardArea;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = area.icon;
  const domain = DOMAINS[area.domain];

  return (
    <Link
      href={area.href}
      aria-current={active ? "page" : undefined}
      aria-label={area.name}
      title={collapsed ? area.name : undefined}
      className={`group flex min-w-0 items-center gap-2 rounded-2xl px-2 py-2 transition-[background-color,color,transform] duration-200 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/10 ${
        active
          ? "bg-foreground text-background shadow-sm hover:bg-foreground dark:hover:bg-foreground"
          : "text-foreground"
      }`}
    >
      <span
        className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${domain.from}, ${domain.to})`,
        }}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={ICON_STROKE} />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">
            {area.name}
          </span>
          <span
            className={`block truncate text-[11px] ${active ? "text-background/70" : "text-muted-foreground"}`}
          >
            {domain.label}
          </span>
        </span>
      )}
    </Link>
  );
}

function UtilityLink({
  href,
  label,
  active,
  collapsed,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  icon: typeof MessageSquare;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={`flex min-w-0 items-center gap-2 rounded-2xl px-2 py-2 text-sm font-semibold transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/10 ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl bg-black/5 dark:bg-white/10">
        <Icon className="h-4.5 w-4.5" strokeWidth={ICON_STROKE} />
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
