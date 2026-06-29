'use client';

import React from 'react';
import { cn } from '@/lib/cn';

/**
 * Card / Panel COMPARTIDO — superficie consistente para el descuadre recurrente
 * de tarjetas: fondo opaco (`bg-card`), borde y radio de tokens, y una sombra
 * neutra tematizada. Evita la mezcla de `bg-white`/`bg-gray-…` hardcodeados que
 * rompía el contraste en modo oscuro.
 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-sm)]',
          className,
        )}
        {...props}
      />
    );
  },
);

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-border px-5 py-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 border-t border-border px-5 py-4', className)} {...props} />
  );
}

export default Card;
