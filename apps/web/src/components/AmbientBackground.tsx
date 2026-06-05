'use client';

import React from 'react';

/**
 * Capa de fondo ambiental fija a pantalla completa.
 * Reemplaza el blanco plano con manchas de color difusas y desaturadas.
 * Se monta una sola vez en el layout de /dashboard.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef0f4] dark:bg-[#0e0e11]"
    >
      <div className="absolute -left-40 top-20 h-[560px] w-[560px] rounded-full bg-[#F6C7A8] opacity-50 blur-[130px] dark:bg-[#5a3d2e] dark:opacity-25" />
      <div className="absolute right-[-180px] top-48 h-[520px] w-[520px] rounded-full bg-[#C9C0F2] opacity-50 blur-[130px] dark:bg-[#332e5a] dark:opacity-25" />
      <div className="absolute left-1/3 bottom-[-160px] h-[520px] w-[520px] rounded-full bg-[#AEE3D0] opacity-45 blur-[130px] dark:bg-[#1f4a3c] dark:opacity-20" />
    </div>
  );
}
