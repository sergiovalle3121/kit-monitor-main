'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, ShieldCheck, Building2 } from 'lucide-react';

const TABS: { href: string; label: string; icon: React.ElementType }[] = [
  { href: '/dashboard/settings/users', label: 'Usuarios y roles', icon: Users },
  { href: '/dashboard/settings/permissions', label: 'Matriz de permisos', icon: ShieldCheck },
  { href: '/dashboard/settings/organization', label: 'Organización', icon: Building2 },
];

/** Pill sub-nav shared across the Settings section. */
export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#F5F5F7] dark:bg-white/5 border border-[#F2F2F7] dark:border-white/10">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname?.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              active
                ? 'bg-white dark:bg-white/15 text-[#1D1D1F] dark:text-white shadow-sm'
                : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
