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
          /* Light mode: a soft cool tint, NORMAL blend (screen is invisible on white). */
          background: radial-gradient(
            56% 48% at 50% 34%,
            rgba(129, 140, 248, 0.16) 0%,
            rgba(96, 165, 250, 0.12) 40%,
            rgba(45, 212, 191, 0.07) 62%,
            transparent 74%
          );
          filter: blur(44px);
          opacity: 0;
          animation: axosBloom 3.1s cubic-bezier(0.33, 0, 0.2, 1) 0.1s 1 both;
          will-change: opacity, transform;
        }
        :global(.dark) .axos-bloom {
          /* Dark mode: a light glow that lifts the scene; screen reads well on dark. */
          background: radial-gradient(
            56% 48% at 50% 34%,
            rgba(168, 199, 246, 0.20) 0%,
            rgba(129, 140, 248, 0.14) 42%,
            transparent 72%
          );
          mix-blend-mode: screen;
        }
        @keyframes axosBloom {
          0% { opacity: 0; transform: scale(1.06); }
          32% { opacity: 1; transform: scale(1.0); }
          66% { opacity: 1; transform: scale(1.0); }
          100% { opacity: 0; transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
}
