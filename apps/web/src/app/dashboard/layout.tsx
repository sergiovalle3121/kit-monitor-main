import React from 'react';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { WorkspaceGuard } from '@/components/WorkspaceGuard';
import { DashboardShell } from '@/components/DashboardShell';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Fondo aurora + chrome compartida (barra superior + dock) para TODO
          /dashboard/*, de modo que la estética y la navegación se mantengan al
          entrar a cualquier área (estilo Apple). */}
      <AuroraBackground />
      <WorkspaceGuard>
        <DashboardShell>{children}</DashboardShell>
      </WorkspaceGuard>
    </>
  );
}
