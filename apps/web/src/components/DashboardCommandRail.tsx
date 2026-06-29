"use client";

import React, { useMemo, useState } from "react";
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

/**
 * Desktop command rail for the dashboard shell. It reuses the existing module
 * registry (`AREAS`) and the same role filtering as the hub/dock, so AXOS has
 * one navigation source instead of a parallel sidebar model. The rail is hidden
 * on mobile (the bottom dock remains the mobile navigation) and only mounted by
 * `DashboardShell` for standard/command-center chrome.
 */
export function DashboardCommandRail() {
  const pathname = usePathname() || "";
  const { session } = useDashboardSession();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = isAdminAccess(session?.role, session?.email);
  const seesAll = seesAllAreas(session?.role, session?.email);
  const role = session?.role || "";

  const sections = useMemo(() => {
    const visible = AREAS.filter(
      (area) => seesAll || area.roles.includes(role),
    );
    return SECTION_ORDER.map((section) => ({
      section,
      areas: visible.filter((area) => area.section === section),
    })).filter((group) => group.areas.length > 0);
  }, [role, seesAll]);

  const active = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      aria-label="Navegación principal por dominios"
      className={`fixed left-4 top-24 z-40 hidden max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55)] ring-1 ring-slate-950/[0.03] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/75 dark:ring-white/10 lg:flex ${
        collapsed ? "w-[5.25rem]" : "w-72"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-slate-950/[0.06] px-4 py-4 dark:border-white/10">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold tracking-tight text-white shadow-sm dark:bg-white dark:text-slate-950">
          AX
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
              Command rail
            </p>
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Dominios AXOS
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={
            collapsed
              ? "Expandir navegación lateral"
              : "Colapsar navegación lateral"
          }
          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-950/[0.06] hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <RailItem
          href="/dashboard"
          label="Inicio"
          icon={LayoutGrid}
          active={active("/dashboard")}
          collapsed={collapsed}
        />
        <RailItem
          href="/dashboard/chat"
          label="Mensajes"
          icon={MessageSquare}
          active={active("/dashboard/chat")}
          collapsed={collapsed}
        />

        <div className="mt-3 space-y-4">
          {sections.map(({ section, areas }) => (
            <section key={section} aria-label={section}>
              {!collapsed && (
                <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {section}
                </h2>
              )}
              <div className="space-y-1">
                {areas.map((area) => (
                  <RailArea
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
      </div>

      {isAdmin && (
        <div className="border-t border-slate-950/[0.06] p-3 dark:border-white/10">
          <RailItem
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

function RailArea({
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
      title={collapsed ? area.name : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
        active
          ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
          : "text-slate-600 hover:bg-slate-950/[0.05] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${domain.from}, ${domain.to})`,
        }}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {area.name}
          </span>
          <span
            className={`block truncate text-xs ${active ? "text-white/70 dark:text-slate-700" : "text-slate-400 dark:text-slate-500"}`}
          >
            {area.desc}
          </span>
        </span>
      )}
    </Link>
  );
}

function RailItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
        active
          ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
          : "text-slate-600 hover:bg-slate-950/[0.05] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl ${active ? "bg-white/15 dark:bg-slate-950/10" : glass}`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
      </span>
      {!collapsed && (
        <span className="truncate text-sm font-medium">{label}</span>
      )}
    </Link>
  );
}
