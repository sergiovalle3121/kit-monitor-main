'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, LineChart, Warehouse, Settings, type LucideIcon } from 'lucide-react';
import { glass } from '@/lib/glass';
import { isAdminAccess } from '@/lib/owner';

/**
 * Dock inferior compartido del dashboard. Vive en el layout para que toda
 * página /dashboard/* lo herede. El link de Ajustes respeta el gating de admin
 * (con override de owner por email). Marca activo según la ruta actual.
 */
export function DashboardDock() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(isAdminAccess(d?.session?.role, d?.session?.email)))
      .catch(() => {});
  }, []);

  const active = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : !!pathname?.startsWith(href);

  return (
    <div className={`${glass} fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 py-3 rounded-[2rem] shadow-2xl flex items-center gap-2`}>
      <DockLink href="/dashboard" active={active('/dashboard')} icon={LayoutGrid} label="Inicio" />
      <DockLink href="/dashboard/planning" active={active('/dashboard/planning')} icon={LineChart} label="Planeación" />
      <DockLink href="/dashboard/almacen" active={active('/dashboard/almacen')} icon={Warehouse} label="Almacén" />
      {isAdmin && (
        <DockLink href="/dashboard/settings/organization" active={active('/dashboard/settings')} icon={Settings} label="Ajustes" />
      )}
    </div>
  );
}

function DockLink({ href, icon: Icon, label, active }: { href: string; icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`p-3 rounded-full transition-all hover:scale-110 active:scale-95 ${
        active
          ? 'bg-black dark:bg-white text-white dark:text-black'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/10'
      }`}
    >
      <Icon className="w-5 h-5" />
    </Link>
  );
}
