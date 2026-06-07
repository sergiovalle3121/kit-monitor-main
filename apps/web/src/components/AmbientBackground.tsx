'use client';

import React from 'react';
import { NodeNetwork } from './NodeNetwork';

/**
 * Capa de fondo ambiental fija a pantalla completa ("aurora + noise").
 *
 * Manchas de color difusas y desaturadas que derivan lentamente (drift de
 * 24-30s, ease-in-out, loop) + una capa de noise SVG muy sutil. Reutilizable
 * detrás de la landing y del hub.
 *
 * `calm`: variante de baja intensidad para superficies de trabajo (hub), más
 * amable para la vista en sesiones largas. La landing usa la variante normal.
 *
 * La animación de drift se desactiva sola con prefers-reduced-motion (regla
 * global en globals.css). Es decorativa (aria-hidden, pointer-events-none).
 */
export function AmbientBackground({
  className = '',
  calm = false,
  network = false,
}: {
  className?: string;
  calm?: boolean;
  /** Overlay a subtle moving node-network (uniting departments). */
  network?: boolean;
}) {
  const o = calm
    ? {
        a: 'opacity-[0.28] dark:opacity-20',
        b: 'opacity-[0.24] dark:opacity-20',
        c: 'opacity-[0.20] dark:opacity-[0.15]',
        noise: 'opacity-[0.025] dark:opacity-[0.05]',
      }
    : {
        a: 'opacity-50 dark:opacity-25',
        b: 'opacity-45 dark:opacity-25',
        c: 'opacity-40 dark:opacity-20',
        noise: 'opacity-[0.04] dark:opacity-[0.06]',
      };

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f1f3f7] dark:bg-[#0e0e11] ${className}`}
    >
      <div className={`axos-blob axos-blob-a absolute -left-40 top-20 h-[560px] w-[560px] rounded-full bg-[#C9C0F2] ${o.a} blur-[140px] dark:bg-[#332e5a]`} />
      <div className={`axos-blob axos-blob-b absolute right-[-180px] top-48 h-[520px] w-[520px] rounded-full bg-[#A8C7F6] ${o.b} blur-[140px] dark:bg-[#2e3a5a]`} />
      <div className={`axos-blob axos-blob-c absolute left-1/3 bottom-[-160px] h-[520px] w-[520px] rounded-full bg-[#AEE3D0] ${o.c} blur-[140px] dark:bg-[#1f4a3c]`} />
      {/* Red de nodos en movimiento (muy sutil) — encaja con "unir departamentos". */}
      {network && (
        <NodeNetwork
          className={calm ? 'opacity-[0.18] dark:opacity-[0.16]' : 'opacity-30 dark:opacity-25'}
          maxNodes={calm ? 32 : 48}
        />
      )}
      {/* Noise sutil por encima de los blobs, debajo del contenido. */}
      <div className={`axos-noise absolute inset-0 ${o.noise} mix-blend-overlay`} />
    </div>
  );
}
