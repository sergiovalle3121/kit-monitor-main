'use client';

import React, { useCallback, useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Collapsible/Accordion COMPARTIDO — causa raíz de los "colapsables
 * descuadrados": cada lane hacía el suyo a mano, sin altura ni animación
 * consistentes y, a menudo, sin `aria-expanded`/`aria-controls`.
 *
 * - Header clickable (botón real) con chevron que rota; `aria-expanded` +
 *   `aria-controls` correctos.
 * - Animación de altura consistente (framer-motion `height: auto`), que respeta
 *   `prefers-reduced-motion`.
 * - Controlado (`open` + `onOpenChange`) o no-controlado (`defaultOpen`).
 * - Tematizado con tokens (claro/oscuro): `text-foreground`, `border-border`,
 *   hover sobre `bg-muted`.
 */
export interface CollapsibleProps {
  /** Contenido del encabezado (texto o nodo). */
  title: React.ReactNode;
  /** Icono/slot a la izquierda del título (opcional). */
  icon?: React.ReactNode;
  /** Slot a la derecha del header, antes del chevron (badges, conteos…). */
  aside?: React.ReactNode;
  /** Estado controlado. Si se pasa, el componente no guarda estado propio. */
  open?: boolean;
  /** Estado inicial en modo no-controlado. */
  defaultOpen?: boolean;
  /** Notifica cambios de apertura (ambos modos). */
  onOpenChange?: (open: boolean) => void;
  /** Deshabilita la interacción. */
  disabled?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export function Collapsible({
  title,
  icon,
  aside,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  headerClassName,
  contentClassName,
  children,
  'data-testid': testId,
}: CollapsibleProps) {
  const reduce = useReducedMotion();
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolled;
  const contentId = useId();

  const toggle = useCallback(() => {
    if (disabled) return;
    const next = !open;
    if (!isControlled) setUncontrolled(next);
    onOpenChange?.(next);
  }, [disabled, open, isControlled, onOpenChange]);

  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}
      data-testid={testId}
      data-state={open ? 'open' : 'closed'}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={contentId}
        data-testid={testId ? `${testId}-trigger` : undefined}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left',
          'text-sm font-medium text-foreground',
          'transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          headerClassName,
        )}
      >
        {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {aside && <span className="flex-shrink-0 text-muted-foreground">{aside}</span>}
        <ChevronDown
          aria-hidden
          className={cn(
            'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            role="region"
            key="content"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={reduce ? {} : { height: 'auto', opacity: 1 }}
            exit={reduce ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn('border-t border-border px-4 py-3 text-sm text-foreground', contentClassName)}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Collapsible;
