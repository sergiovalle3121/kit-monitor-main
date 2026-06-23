'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, MessageSquare, Settings, type LucideIcon } from 'lucide-react';
import { glass } from '@/lib/glass';
import { isAdminAccess, seesAllAreas } from '@/lib/owner';
import { useDashboardSession } from '@/hooks/useDashboardSession';
import { AREAS, type DashboardArea } from '@/lib/dashboardAreas';

/**
 * Dock inferior compartido del dashboard. Vive en el layout para que toda
 * página /dashboard/* lo herede.
 *
 * Accesos rápidos role-aware: se derivan de las áreas a las que el usuario tiene
 * acceso (MISMA lógica que el hub vía seesAllAreas), tomando las más operativas
 * de una lista de prioridad y limitándolas para mantener el dock esbelto. Inicio
 * y Mensajes están siempre (chat/llamadas son para todos); Ajustes respeta el
 * gating de admin (override de owner por email). Marca activo según la ruta.
 */

// Orden de prioridad de los accesos rápidos (destinos más operativos). Solo se
// muestran los que el rol puede ver; admin/owner los ve todos. Íconos y nombres
// salen del catálogo AREAS (fuente única), sin duplicar.
const DOCK_PRIORITY = [
  '/dashboard/production-plan',
  '/dashboard/planning',
  '/dashboard/almacen',
  '/dashboard/production',
  '/dashboard/inventory',
  '/dashboard/quality',
  '/dashboard/materials',
  '/dashboard/intelligence',
];
const MAX_QUICK_LINKS = 3;

export function DashboardDock() {
  const pathname = usePathname();
  const { session } = useDashboardSession();
  const isAdmin = isAdminAccess(session?.role, session?.email);
  const seesAll = seesAllAreas(session?.role, session?.email);
  const role = session?.role || '';

  // Reusa el filtrado del hub: admin/owner ve todo; un rol limitado solo las suyas.
  const quickLinks = DOCK_PRIORITY
    .map((href) => AREAS.find((a) => a.href === href))
    .filter((a): a is DashboardArea => !!a && (seesAll || a.roles.includes(role)))
    .slice(0, MAX_QUICK_LINKS);

  const active = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : !!pathname?.startsWith(href);

  return (
    <div className={`${glass} fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4 py-3 rounded-[2rem] shadow-2xl flex items-center gap-2`}>
      <DockLink href="/dashboard" active={active('/dashboard')} icon={LayoutGrid} label="Inicio" />
      <DockLink href="/dashboard/chat" active={active('/dashboard/chat')} icon={MessageSquare} label="Mensajes" />
      {quickLinks.map((a) => (
        <DockLink key={a.href} href={a.href} active={active(a.href)} icon={a.icon} label={a.name} />
      ))}
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
      title={label}
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
