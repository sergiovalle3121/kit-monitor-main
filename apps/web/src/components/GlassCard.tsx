'use client';

import React from 'react';
import clsx from 'clsx';
import { glass } from '@/lib/glass';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Radio de esquina; por defecto el squircle aproximado de iOS. */
  rounded?: string;
}

/**
 * Superficie base con material translúcido. Aplica el borde de medio píxel
 * translúcido y el desenfoque definidos por la clase `glass`.
 */
export function GlassCard({
  className,
  rounded = 'rounded-[24px]',
  children,
  ...rest
}: GlassCardProps) {
  return (
    <div className={clsx(glass, rounded, className)} {...rest}>
      {children}
    </div>
  );
}
