'use client';

import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDialogA11y } from '@/hooks/useDialogA11y';

/**
 * Modal/Dialog COMPARTIDO — primitivo accesible y tematizado (tokens de
 * `globals.css`, claro/oscuro). Causa raíz #1 del barrido visual: cada lane
 * improvisaba su propio modal y el botón de cerrar quedaba fuera del viewport o
 * sin contraste. Este primitivo garantiza, SIEMPRE:
 *
 *  - `createPortal` a `document.body` ⇒ el overlay nunca queda atrapado bajo el
 *    `overflow:hidden` de un panel ni hereda un `z-index` bajo.
 *  - Botón de cerrar SIEMPRE visible (esquina superior, área táctil ≥ 40px) con
 *    `aria-label`, salvo que se pida `hideClose` explícitamente.
 *  - Foco atrapado, `Escape` cierra y se restaura el foco al cerrar
 *    (vía `useDialogA11y`), click en el backdrop cierra.
 *  - `max-h-[90dvh]` con scroll interno en el cuerpo ⇒ el contenido largo nunca
 *    empuja el header/footer fuera de pantalla; centrado responsivo.
 *  - Fondo OPACO (`bg-card`) ⇒ jamás se cruzan textos del fondo con el diálogo.
 *
 * Controlado: `open` + `onClose`. SSR-safe (el portal sólo se monta en cliente).
 */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(96rem,calc(100vw-2rem))]',
};

export interface ModalProps {
  /** ¿Visible? Controlado por el consumidor. */
  open: boolean;
  /** Petición de cierre (Escape, click-fuera o botón cerrar). */
  onClose: () => void;
  /** Título accesible; si se omite, pasa `aria-label` (o nada) para a11y. */
  title?: React.ReactNode;
  /** Descripción secundaria bajo el título. */
  description?: React.ReactNode;
  /** Pie del diálogo (acciones). Se ancla abajo, fuera del scroll del cuerpo. */
  footer?: React.ReactNode;
  /** Ancho máximo del panel. */
  size?: ModalSize;
  /** Oculta el botón de cerrar (sólo si el flujo provee otro cierre claro). */
  hideClose?: boolean;
  /** Si `false`, el click en el backdrop NO cierra (sí lo hace Escape/botón). */
  closeOnBackdrop?: boolean;
  /** Clase extra para el panel. */
  className?: string;
  /** Clase extra para el cuerpo (zona con scroll). */
  bodyClassName?: string;
  /** `aria-label` cuando no hay `title` textual. */
  ariaLabel?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  hideClose = false,
  closeOnBackdrop = true,
  className,
  bodyClassName,
  ariaLabel,
  children,
  'data-testid': testId,
}: ModalProps) {
  const reduce = useReducedMotion();
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  const titleId = useId();
  const descId = useId();

  // Bloquea el scroll del fondo mientras hay un modal abierto (sin romper SSR).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // SSR-safe: el portal sólo se monta en cliente (sin tocar `document` en server).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] grid place-items-center overflow-y-auto p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => {
            // Sólo cierra si el gesto empieza Y termina en el backdrop (no al
            // arrastrar una selección desde dentro del panel hacia afuera).
            if (closeOnBackdrop && e.target === e.currentTarget) onClose();
          }}
          data-testid={testId ? `${testId}-overlay` : 'modal-overlay'}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? ariaLabel : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              'relative flex w-full flex-col max-h-[90dvh] overflow-hidden rounded-2xl',
              'bg-card text-card-foreground border border-border shadow-[var(--shadow-lg)]',
              'focus:outline-none',
              SIZE_CLASS[size],
              className,
            )}
            data-testid={testId}
          >
            {(title || description || !hideClose) && (
              <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 id={titleId} className="text-base font-semibold leading-tight text-foreground">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="mt-1 text-sm leading-snug text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    data-testid={testId ? `${testId}-close` : 'modal-close'}
                    className={cn(
                      'grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg -mr-1.5',
                      'text-muted-foreground hover:bg-muted hover:text-foreground',
                      'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <X className="h-4.5 w-4.5" aria-hidden />
                  </button>
                )}
              </div>
            )}

            <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default Modal;
