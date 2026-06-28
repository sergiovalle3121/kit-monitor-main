'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ICON_STROKE } from '@/lib/design/domains';

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Color de acento del ícono (hex). Por defecto índigo. */
  accent?: string;
  /** Contenido del cuerpo: campos del registro, líneas de tiempo, etc. */
  children: ReactNode;
  /** Sección de "relacionados" (slots/children) bajo el cuerpo. */
  related?: ReactNode;
  /** Acciones (transiciones) ancladas al pie. */
  actions?: ReactNode;
  /** Ancho del panel en px (se limita a 100vw). */
  width?: number;
}

/**
 * Panel lateral (sheet) accesible que abre al click en una fila: muestra el
 * detalle del registro, una sección de relacionados y un pie de acciones.
 * Cierra con Esc, atrapa el foco, bloquea el scroll de fondo y respeta
 * prefers-reduced-motion. Genérico — el contenido lo compone quien lo usa.
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  accent = '#6366f1',
  children,
  related,
  actions,
  width = 480,
}: DetailDrawerProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = 'detail-drawer-title';

  // Esc cierra; Tab atrapa el foco dentro del panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const f = panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!f || f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Foco inicial al abrir + bloqueo del scroll de fondo.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: `min(${width}px, 100vw)` }}
            className="absolute right-0 top-0 flex h-full flex-col border-l border-black/10 bg-white/95 backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-900/95"
          >
            {/* Encabezado */}
            <header className="flex items-start gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
              {Icon && (
                <span
                  aria-hidden
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: `${accent}1f`, color: accent }}
                >
                  <Icon className="h-5 w-5" strokeWidth={ICON_STROKE} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-base font-semibold leading-tight text-foreground">
                  {title}
                </h2>
                {subtitle && <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {children}
              {related && <div className="mt-6">{related}</div>}
            </div>

            {/* Pie de acciones */}
            {actions && (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-black/5 px-5 py-4 dark:border-white/10">
                {actions}
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Grupo titulado dentro del drawer (p.ej. "Detalle", "Relacionados"). */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      {children}
    </section>
  );
}

/** Fila etiqueta → valor para el cuerpo del drawer. */
export function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 py-2 text-sm last:border-0 dark:border-white/5">
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{children}</span>
    </div>
  );
}
