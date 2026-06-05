import React from 'react';
import { AmbientBackground } from '@/components/AmbientBackground';

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AmbientBackground />
      {children}
    </>
  );
}
