'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * Si el usuario tiene varios edificios o proyectos y no ha elegido todavía,
 * lo manda al selector de workspace antes de mostrar cualquier página del
 * dashboard. La página del propio selector queda exenta para evitar bucles.
 */
export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { needsSelection, isLoading } = useWorkspace();

  useEffect(() => {
    if (isLoading) return;
    if (pathname?.startsWith('/dashboard/select-workspace')) return;
    if (needsSelection) {
      const next = pathname || '/dashboard';
      router.replace(`/dashboard/select-workspace?next=${encodeURIComponent(next)}`);
    }
  }, [needsSelection, isLoading, pathname, router]);

  return <>{children}</>;
}
