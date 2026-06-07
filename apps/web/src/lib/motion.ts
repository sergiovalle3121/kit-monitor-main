import type { Variants, Transition } from 'framer-motion';

/**
 * Variantes y transiciones de movimiento compartidas ("vivo y cristalino").
 *
 * Animan sólo `opacity` y `transform` (y/scale) para mantener bajo el coste de GPU.
 * Spring stiffness ~300 / damping ~30. Para transiciones no-spring se usa el easing
 * global `cubic-bezier(0.16, 1, 0.3, 1)` (ver `--ease-out-expo` en globals.css).
 *
 * Cada helper `*RM(reduce)` recibe el flag de `useReducedMotion()` y degrada a un
 * simple fade (o a nada) cuando el usuario pide menos movimiento.
 */

export const spring: Transition = { type: 'spring', stiffness: 300, damping: 30 };
export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Contenedor con entrada escalonada de sus hijos. */
export const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Hijo: fade + translateY + scale 0.96 -> 1 con spring. */
export const item: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
};

/** Alias semántico de `item` para revelados por scroll. */
export const fadeUp = item;

/** Micro-interacciones: lift en hover, press al pulsar. */
export const hoverLift = { y: -4, scale: 1.02, transition: spring };
export const press = { scale: 0.98 };

// ---- Helpers conscientes de prefers-reduced-motion --------------------------

export const containerRM = (reduce: boolean | null): Variants =>
  reduce ? { hidden: {}, show: {} } : container;

export const itemRM = (reduce: boolean | null): Variants =>
  reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : item;

export const hoverRM = (reduce: boolean | null) => (reduce ? undefined : hoverLift);
export const pressRM = (reduce: boolean | null) => (reduce ? undefined : press);
