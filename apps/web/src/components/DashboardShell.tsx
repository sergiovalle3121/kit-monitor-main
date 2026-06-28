"use client";

import React from "react";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { DashboardDock } from "@/components/DashboardDock";
import { DashboardCommandRail } from "@/components/DashboardCommandRail";
import { DashboardWayfinding } from "@/components/DashboardWayfinding";
import { useRouteChrome } from "@/lib/routeChrome";

/**
 * Chrome compartida del dashboard: monta la barra superior + el dock UNA vez
 * para todas las páginas /dashboard/*, con el padding superior que respeta el
 * alto de la barra. Las páginas a pantalla completa (chat, selector de
 * workspace) van "bare" (sin chrome ni padding) para no romper su layout propio.
 *
 * El Operator Terminal en modo Kiosko también va "bare": esconde el chrome
 * global para una vista de línea enfocada (la navegación de vuelta vive en su
 * propio topbar industrial).
 *
 * El tipo de cromo por ruta lo resuelve `useRouteChrome` (Shell Taxonomy, fuente
 * única). Los workbenches (editor de Office) montan su propio frame full-screen,
 * así que ocultamos el dock para no dejarlo en el DOM bajo el overlay.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { bare, hideDock, hideCommandRail } = useRouteChrome();

  if (bare) return <>{children}</>;

  return (
    <>
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-2xl focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-xl dark:focus:bg-white dark:focus:text-slate-950"
      >
        Saltar al contenido
      </a>
      <DashboardTopBar />
      {!hideCommandRail && <DashboardCommandRail />}
      <div
        id="dashboard-content"
        tabIndex={-1}
        className="pt-20 focus:outline-none lg:pl-80"
      >
        <DashboardWayfinding />
        {children}
      </div>
      {!hideDock && <DashboardDock />}
    </>
  );
}
