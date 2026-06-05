import type { Variants } from 'framer-motion';

/**
 * Variantes de movimiento compartidas para la entrada escalonada de la home.
 * Animan solo `opacity` y `transform` (y) para mantener el coste de GPU bajo.
 */
export const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04 },
  },
};

export const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
};
