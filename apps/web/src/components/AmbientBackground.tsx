'use client';

import React from 'react';

/**
 * Capa de fondo ambiental fija a pantalla completa ("aurora + noise").
 *
 * Reemplaza el blanco plano con 2-3 manchas de color difusas y desaturadas que
 * derivan lentamente (drift de 24-30s, ease-in-out, loop) + una capa de noise SVG
 * muy sutil para textura cristalina. Reutilizable detrás de la landing y del hub.
 *
 * La animación de drift se desactiva sola con prefers-reduced-motion (regla global
 * en globals.css). Es puramente decorativa (aria-hidden, pointer-events-none).
 */
export function AmbientBackground({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef0f4] dark:bg-[#0e0e11] ${className}`}
    >
      <div className="axos-blob axos-blob-a absolute -left-40 top-20 h-[560px] w-[560px] rounded-full bg-[#C9C0F2] opacity-50 blur-[130px] dark:bg-[#332e5a] dark:opacity-25" />
      <div className="axos-blob axos-blob-b absolute right-[-180px] top-48 h-[520px] w-[520px] rounded-full bg-[#A8C7F6] opacity-45 blur-[130px] dark:bg-[#2e3a5a] dark:opacity-25" />
      <div className="axos-blob axos-blob-c absolute left-1/3 bottom-[-160px] h-[520px] w-[520px] rounded-full bg-[#AEE3D0] opacity-40 blur-[130px] dark:bg-[#1f4a3c] dark:opacity-20" />
      {/* Noise sutil (~4%) por encima de los blobs, debajo del contenido. */}
      <div className="axos-noise absolute inset-0 opacity-[0.04] mix-blend-overlay dark:opacity-[0.06]" />
    </div>
  );
}
