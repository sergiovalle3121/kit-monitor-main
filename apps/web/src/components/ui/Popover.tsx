'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';

/**
 * Popover / DropdownMenu COMPARTIDO — causa raíz de "se cruzan los textos /
 * transparencia": los menús ad-hoc se renderizaban en el flujo, sin portal, con
 * `z-index` bajo y fondo semitransparente, así que el texto de detrás se leía a
 * través del menú. Este primitivo garantiza, SIEMPRE:
 *
 *  - `createPortal` a `document.body` + `position: fixed` ⇒ nunca lo recorta el
 *    `overflow` de un ancestro ni hereda un apilamiento bajo.
 *  - `z-[350]` (por encima de modales `z-[300]`, por debajo del confirm `z-[400]`).
 *  - Fondo OPACO (`bg-popover`) ⇒ jamás se trasluce el texto del fondo.
 *  - Posicionamiento consciente del viewport: voltea arriba/abajo y se ancla a
 *    `start`/`end` sin salirse de pantalla; `max-height` con scroll interno.
 *  - Cierra con Escape, click-fuera y (en menú) al elegir un ítem.
 */

type Side = 'bottom' | 'top';
type Align = 'start' | 'end';

interface AnchoredStyle {
  top: number;
  left: number;
  maxHeight: number;
  side: Side;
}

const GAP = 6; // separación trigger↔panel
const MARGIN = 8; // margen mínimo al borde del viewport

function computePosition(
  trigger: DOMRect,
  panel: { width: number; height: number },
  preferredSide: Side,
  align: Align,
): AnchoredStyle {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - trigger.bottom - GAP - MARGIN;
  const spaceAbove = trigger.top - GAP - MARGIN;

  // Voltea sólo si el lado preferido no cabe y el opuesto tiene más sitio.
  let side = preferredSide;
  if (preferredSide === 'bottom' && panel.height > spaceBelow && spaceAbove > spaceBelow) {
    side = 'top';
  } else if (preferredSide === 'top' && panel.height > spaceAbove && spaceBelow > spaceAbove) {
    side = 'bottom';
  }

  const maxHeight = Math.max(120, side === 'bottom' ? spaceBelow : spaceAbove);
  const top = side === 'bottom' ? trigger.bottom + GAP : trigger.top - GAP - Math.min(panel.height, maxHeight);

  let left = align === 'start' ? trigger.left : trigger.right - panel.width;
  left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - panel.width - MARGIN));

  return { top, left, maxHeight, side };
}

export interface PopoverProps {
  /** El disparador. Se le inyectan handlers/aria; debe ser un único nodo focusable. */
  trigger: React.ReactElement;
  children: React.ReactNode;
  side?: Side;
  align?: Align;
  /** Ancho del panel; por defecto se adapta al contenido (`min-w`). */
  className?: string;
  /** Semántica de menú (`role="menu"`): cierra al hacer click en un ítem. */
  menu?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  'data-testid'?: string;
}

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  className,
  menu = false,
  open: controlledOpen,
  onOpenChange,
  'data-testid': testId,
}: PopoverProps) {
  const reduce = useReducedMotion();
  const isControlled = controlledOpen !== undefined;
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolled;

  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<AnchoredStyle | null>(null);
  const panelId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const reposition = useCallback(() => {
    const t = triggerRef.current;
    const p = panelRef.current;
    if (!t || !p) return;
    setStyle(
      computePosition(
        t.getBoundingClientRect(),
        { width: p.offsetWidth, height: p.offsetHeight },
        side,
        align,
      ),
    );
  }, [side, align]);

  // Posiciona tras pintar el panel y reacciona a scroll/resize mientras esté abierto.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, reposition]);

  // Escape + click-fuera.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus?.();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, setOpen]);

  // Inyecta ref + handlers + aria en el trigger sin envolverlo en un wrapper
  // (que rompería el layout de los consumidores). `trigger` es ReactElement con
  // props `any`, así que cloneElement acepta `ref`/aria sin fricción de tipos.
  const triggerProps = (trigger.props ?? {}) as { onClick?: (e: React.MouseEvent) => void };
  const originalRef = (trigger as { ref?: React.Ref<HTMLElement> }).ref;
  const injected = {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof originalRef === 'function') originalRef(node);
      else if (originalRef && typeof originalRef === 'object') {
        // eslint-disable-next-line react-hooks/immutability -- forward estándar de un ref de objeto del trigger
        (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    'aria-haspopup': menu ? 'menu' : 'dialog',
    'aria-expanded': open,
    'data-testid': testId ? `${testId}-trigger` : undefined,
    onClick: (e: React.MouseEvent) => {
      triggerProps.onClick?.(e);
      setOpen(!open);
    },
  };
  const triggerEl = React.cloneElement(trigger, injected);

  return (
    <>
      {triggerEl}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                id={panelId}
                role={menu ? 'menu' : 'dialog'}
                style={{
                  position: 'fixed',
                  top: style?.top ?? -9999,
                  left: style?.left ?? -9999,
                  maxHeight: style?.maxHeight,
                  visibility: style ? 'visible' : 'hidden',
                }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: side === 'bottom' ? -4 : 4 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                onClick={() => {
                  if (menu) setOpen(false);
                }}
                className={cn(
                  'z-[350] min-w-[10rem] overflow-y-auto rounded-xl p-1',
                  'bg-popover text-popover-foreground border border-border shadow-[var(--shadow-lg)]',
                  className,
                )}
                data-testid={testId}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** Ítem de menú estándar dentro de `<Popover menu>`. */
export function DropdownItem({
  children,
  onSelect,
  disabled,
  destructive,
  icon,
  className,
  'data-testid': testId,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      data-testid={testId}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
        'text-foreground transition-colors hover:bg-muted',
        'focus:outline-none focus-visible:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
        destructive && 'text-danger hover:bg-danger/10',
        className,
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

/** Separador entre grupos de ítems. */
export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

/**
 * Azúcar para el caso más común: un menú anclado a un botón. Equivale a
 * `<Popover menu trigger={...}>`. Mantiene la API mínima de "DropdownMenu".
 */
export function DropdownMenu(props: Omit<PopoverProps, 'menu'>) {
  return <Popover {...props} menu />;
}

export default Popover;
