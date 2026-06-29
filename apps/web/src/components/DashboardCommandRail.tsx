"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  MessageSquare,
  Settings,
} from "lucide-react";
import { isAdminAccess, seesAllAreas } from "@/lib/owner";
import { navSections, type DashboardArea } from "@/lib/dashboardAreas";
import { ICON_STROKE } from "@/lib/design/domains";
import { useDashboardSession } from "@/hooks/useDashboardSession";

/**
 * Desktop command rail — la navegación ÚNICA del dashboard (rail-primario). Reusa
 * el catálogo de áreas (`AREAS`) y el mismo filtrado por rol que el hub/dock, así
 * AXOS tiene una sola fuente de navegación en vez de un sidebar paralelo.
 *
 * Sobriedad (menos cromo, más aire): los íconos van PLANOS y monocromos —el color
 * se reserva para estado (fila activa) y acentos, no para decorar cada ítem con un
 * gradiente por dominio—. El rail se oculta en móvil; ahí la navegación completa
 * vive en `DashboardNavSheet` (abierto desde la barra superior) y el dock inferior.
 */
export function DashboardCommandRail() {
  const pathname = usePathname() || "";
  const { session } = useDashboardSession();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = isAdminAccess(session?.role, session?.email);
  const seesAll = seesAllAreas(session?.role, session?.email);
  const role = session?.role || "";

  const sections = useMemo(
    () => navSections(role, seesAll),
    [role, seesAll],
  );

  const active = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      aria-label="Navegación principal por dominios"
      className={`fixed left-4 top-24 z-40 hidden max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/85 shadow-[0_18px_60px_-44px_rgba(15,23,42,0.5)] ring-1 ring-foreground/[0.02] backdrop-blur-2xl lg:flex ${
        collapsed ? "w-[5rem]" : "w-72"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-foreground text-[13px] font-semibold tracking-tight text-background">
          AX
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              Navegación
            </p>
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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
          className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <RailItem
          href="/dashboard"
          label="Inicio"
          icon={Home}
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
                <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {section}
                </h2>
              )}
              <div className="space-y-0.5">
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
        <div className="border-t border-border/60 p-2.5">
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

/** Fila de área: ícono PLANO monocromo (sin gradiente por dominio). El estado
 *  activo es lo único coloreado (inversión de la fila). */
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

  return (
    <Link
      href={area.href}
      title={collapsed ? area.name : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon
        className="h-[18px] w-[18px] flex-shrink-0"
        strokeWidth={ICON_STROKE}
      />
      {!collapsed && (
        <span className="block min-w-0 flex-1 truncate text-sm font-medium">
          {area.name}
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
      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon
        className="h-[18px] w-[18px] flex-shrink-0"
        strokeWidth={ICON_STROKE}
      />
      {!collapsed && (
        <span className="truncate text-sm font-medium">{label}</span>
      )}
    </Link>
  );
}
