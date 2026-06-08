import React from 'react';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { WorkspaceGuard } from '@/components/WorkspaceGuard';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Fondo aurora único para TODO /dashboard/* (estilo Apple). */}
      <AuroraBackground />
      <WorkspaceGuard>{children}</WorkspaceGuard>
    </>
  );
}
