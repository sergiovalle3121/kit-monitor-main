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
      <DashboardTopBar />
      <div className="pt-20">
        <DashboardWayfinding />
        {children}
      </div>
      <DashboardDock />
    </>
  );
}
