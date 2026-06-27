'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DashboardTopBar } from '@/components/DashboardTopBar';
import { DashboardDock } from '@/components/DashboardDock';
import { DashboardWayfinding } from '@/components/DashboardWayfinding';

/**
 * Chrome compartida del dashboard: monta la barra superior + el dock UNA vez
 * para todas las páginas /dashboard/*, con el padding superior que respeta el
 * alto de la barra. Las páginas a pantalla completa (chat, selector de
 * workspace) van "bare" (sin chrome ni padding) para no romper su layout propio.
 */
const BARE_PREFIXES = ['/dashboard/chat', '/dashboard/select-workspace'];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some((p) => pathname?.startsWith(p));

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
      <div id="dashboard-content" tabIndex={-1} className="pt-20 focus:outline-none">
        <DashboardWayfinding />
        {children}
      </div>
      <DashboardDock />
    </>
  );
}
