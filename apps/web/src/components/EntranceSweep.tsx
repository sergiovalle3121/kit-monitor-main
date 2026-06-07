'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * EntranceSweep — entrada estética suave al cargar la página.
 *
 * Antes era una "ola" que cruzaba rápido y parecía un flash/fantasma. Ahora es un
 * resplandor (bloom) muy suave que aparece y se DESVANECE lentamente una sola vez:
 * la escena "se enciende" con calma, sin barridos rápidos ni sensación de glitch.
 * Decorativo (aria-hidden, pointer-events-none), baja opacidad, una sola pasada,
 * solo opacity/scale (GPU), detrás del contenido, y desactivado con
 * prefers-reduced-motion.
 */
export function EntranceSweep({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className={`axos-bloom-wrap pointer-events-none fixed inset-0 -z-[5] overflow-hidden ${className}`}>
      <div className="axos-bloom" />
      <style jsx>{`
        .axos-bloom {
          position: absolute;
          inset: -15%;
          background: radial-gradient(
            58% 50% at 50% 36%,
            rgba(168, 199, 246, 0.16) 0%,
            rgba(201, 192, 242, 0.10) 38%,
            rgba(174, 227, 208, 0.07) 60%,
            transparent 74%
          );
          filter: blur(36px);
          mix-blend-mode: screen;
          opacity: 0;
          animation: axosBloom 2.8s cubic-bezier(0.33, 0, 0.2, 1) 0.1s 1 both;
          will-change: opacity, transform;
        }
        :global(.dark) .axos-bloom {
          mix-blend-mode: soft-light;
        }
        @keyframes axosBloom {
          0% { opacity: 0; transform: scale(1.06); }
          40% { opacity: 1; transform: scale(1.0); }
          100% { opacity: 0; transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
}
