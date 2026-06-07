'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { spring } from '@/lib/motion';

/**
 * Revela su contenido con un fade-up sutil cuando entra en viewport (scroll).
 * Reutilizable. Respeta prefers-reduced-motion: si está activo, renderiza estático.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}
