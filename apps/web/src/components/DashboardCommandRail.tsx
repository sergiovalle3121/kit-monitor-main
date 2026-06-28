"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { glass } from "@/lib/glass";
import { isAdminAccess, seesAllAreas } from "@/lib/owner";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import { AREAS, SECTION_ORDER, type DashboardArea } from "@/lib/dashboardAreas";
import { DOMAINS, ICON_STROKE } from "@/lib/design/domains";

type RailSection = {
  name: string;
  areas: DashboardArea[];
};

const COMMAND_CENTER_HREFS = new Set([
  "/dashboard",
  "/dashboard/control-tower",
  "/dashboard/line-control-tower",
  "/dashboard/live",
  "/dashboard/mission-control",
  "/dashboard/intelligence",
  "/dashboard/quality",
]);

/**
 * Navegación lateral desktop del shell AXOS. Reusa el catálogo de áreas y el
 * mismo RBAC del hub/dock para no crear un segundo mapa de navegación.
 */
export function DashboardCommandRail() {
  const pathname = usePathname() || "/dashboard";
  const { session } = useDashboardSession();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = isAdminAccess(session?.role, session?.email);
  const seesAll = seesAllAreas(session?.role, session?.email);
  const role = session?.role || "";

  const sections = useMemo<RailSection[]>(() => {
    const visible = AREAS.filter(
      (area) => seesAll || area.roles.includes(role),
    );
    return SECTION_ORDER.map((name) => ({
      name,
      areas: visible.filter((area) => area.section === name),
    })).filter((section) => section.areas.length > 0);
  }, [role, seesAll]);

  const active = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <aside
      aria-label="Navegación principal por dominios"
      className={`${glass} fixed left-4 top-24 z-40 hidden max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-[2rem] border border-white/45 shadow-2xl shadow-slate-950/5 transition-[width] duration-300 dark:border-white/10 lg:flex ${
        collapsed ? "w-[5.25rem]" : "w-72"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-black/5 px-3 py-3 dark:border-white/10">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
          <Search className="h-4.5 w-4.5" strokeWidth={ICON_STROKE} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              Command rail
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Dominios AXOS
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/10"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" strokeWidth={ICON_STROKE} />
          ) : (
            <ChevronLeft className="h-4 w-4" strokeWidth={ICON_STROKE} />
          )}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-3">
        <RailLink
          href="/dashboard"
          label="Inicio"
          icon={LayoutGrid}
          active={active("/dashboard")}
          collapsed={collapsed}
          commandCenter
        />
        <RailLink
          href="/dashboard/chat"
          label="Mensajes"
          icon={MessageSquare}
          active={active("/dashboard/chat")}
          collapsed={collapsed}
        />

        {sections.map((section) => (
          <div key={section.name} className="space-y-1.5">
            {!collapsed && (
              <p className="px-3 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
                {section.name}
              </p>
            )}
            {section.areas.map((area) => {
              const domain = DOMAINS[area.domain];
              return (
                <RailLink
                  key={area.href}
                  href={area.href}
                  label={area.name}
                  icon={area.icon}
                  active={active(area.href)}
                  collapsed={collapsed}
                  accent={domain.solid}
                  commandCenter={COMMAND_CENTER_HREFS.has(area.href)}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {isAdmin && (
        <div className="border-t border-black/5 p-2.5 dark:border-white/10">
          <RailLink
            href="/dashboard/settings/organization"
            label="Ajustes"
            icon={Settings}
            active={active("/dashboard/settings")}
            collapsed={collapsed}
          />
        </div>
      )}
    </aside>
  );
}

function RailLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  accent,
  commandCenter,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed: boolean;
  accent?: string;
  commandCenter?: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground dark:hover:bg-white/10"
      } ${collapsed ? "justify-center" : "justify-start"}`}
    >
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
        style={
          active
            ? undefined
            : {
                color: accent,
                backgroundColor: accent ? `${accent}14` : undefined,
              }
        }
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={ICON_STROKE} />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      )}
      {!collapsed && commandCenter && (
        <span
          className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide ${active ? "bg-background/15 text-background" : "bg-primary/10 text-primary"}`}
        >
          CC
        </span>
      )}
    </Link>
  );
}
