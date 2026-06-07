'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * EntranceSweep — un "barrido" de luz que cruza la pantalla UNA vez al cargar
 * (la "ola de izquierda a derecha"). Decorativo (aria-hidden, pointer-events-none),
 * muy sutil, de una sola pasada (no loop), y se desactiva con
 * prefers-reduced-motion. No cambia la estética: es una capa de luz por encima
 * que se desliza y desaparece. Usa mix-blend para integrarse con el fondo actual.
 */
export function EntranceSweep({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className={`axos-sweep-wrap pointer-events-none fixed inset-0 z-[60] overflow-hidden ${className}`}>
      <div className="axos-sweep" />
      <style jsx>{`
        .axos-sweep {
          position: absolute;
          top: -20%;
          left: 0;
          height: 140%;
          width: 45%;
          transform: translateX(-160%) skewX(-12deg);
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255, 255, 255, 0.10) 42%,
            rgba(168, 199, 246, 0.18) 50%,
            rgba(255, 255, 255, 0.10) 58%,
            transparent 100%
          );
          filter: blur(10px);
          mix-blend-mode: overlay;
          animation: axosSweep 1.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s 1 both;
          will-change: transform, opacity;
        }
        :global(.dark) .axos-sweep {
          mix-blend-mode: soft-light;
        }
        @keyframes axosSweep {
          0% { transform: translateX(-160%) skewX(-12deg); opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translateX(330%) skewX(-12deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
