import React from 'react';
import { AmbientBackground } from '@/components/AmbientBackground';
import { WorkspaceGuard } from '@/components/WorkspaceGuard';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AmbientBackground calm network />
      <WorkspaceGuard>{children}</WorkspaceGuard>
    </>
  );
}
