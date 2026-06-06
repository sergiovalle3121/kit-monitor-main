'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Building2, ChevronDown } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { glass } from '@/lib/glass';

/**
 * Botón compacto que muestra el workspace activo (Edificio · Proyecto) y
 * lleva al selector para cambiarlo. Si el usuario solo tiene 1 edificio y
 * 1 proyecto, no muestra nada (no hay nada que elegir).
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { buildings, projects, buildingId, projectId, isLoading } = useWorkspace();

  if (isLoading) return null;
  if (buildings.length <= 1 && projects.length <= 1) return null;

  const building = buildings.find((b) => b.id === buildingId);
  const project = projects.find((p) => p.id === projectId);

  const label =
    building && project
      ? `${building.name} · ${project.name}`
      : building
        ? building.name
        : project
          ? project.name
          : 'Elegir workspace';

  function goSelect() {
    const next = pathname || '/dashboard';
    router.push(`/dashboard/select-workspace?next=${encodeURIComponent(next)}`);
  }

  return (
    <button
      type="button"
      onClick={goSelect}
      title="Cambiar de edificio o proyecto"
      className={`${glass} flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium`}
    >
      <Building2 className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.5} />
      <span className="max-w-[14rem] truncate">{label}</span>
      <ChevronDown className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.5} />
    </button>
  );
}
