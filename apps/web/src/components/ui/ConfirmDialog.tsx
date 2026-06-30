'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  /** Cuerpo del diálogo (obligatorio). */
  message: string;
  /** Título opcional; por defecto se infiere uno neutro. */
  title?: string;
  /** Texto del botón de confirmar. */
  confirmLabel?: string;
  /** Texto del botón de cancelar. */
  cancelLabel?: string;
  /** `danger` (rojo) para acciones destructivas; `default` para el resto. */
  tone?: 'danger' | 'default';
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn | null>(null);

const norm = (o: ConfirmOptions | string): ConfirmOptions => (typeof o === 'string' ? { message: o } : o);

/**
 * Diálogo de confirmación accesible y reutilizable, sustituto directo de
 * `window.confirm`. Se usa vía `const confirm = useConfirm()` y luego
 * `if (!(await confirm('¿…?'))) return;` — misma lógica, presentación premium.
 *
 * Accesibilidad: `role="dialog"` + `aria-modal`, Escape cancela, foco atrapado
 * dentro del diálogo y el botón de **Cancelar** recibe el foco por defecto
 * (opción segura). Respeta `prefers-reduced-motion`.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = 'confirm-dialog-title';
  const descId = 'confirm-dialog-desc';

  const confirm = useCallback<ConfirmFn>((o) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(norm(o));
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  // Foco inicial en «Cancelar» (opción segura por defecto).
  useEffect(() => {
    if (opts) cancelRef.current?.focus();
  }, [opts]);

  // Escape cancela; Tab atrapa el foco dentro del diálogo.
  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(false);
        return;
      }
      if (e.key === 'Tab') {
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
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
  }, [opts, settle]);

  const danger = opts?.tone === 'danger';

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {opts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] grid place-items-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => settle(false)}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[min(420px,calc(100vw-2rem))] rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.4)] p-5"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 grid place-items-center w-10 h-10 rounded-2xl ${
                    danger
                      ? 'bg-rose-500/10 text-rose-500'
                      : 'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id={titleId} className="text-base font-semibold leading-tight text-foreground">
                    {opts.title ?? '¿Confirmar acción?'}
                  </h2>
                  <p id={descId} className="text-sm text-gray-600 dark:text-gray-300 leading-snug mt-1">
                    {opts.message}
                  </p>
                </div>
                <button
                  onClick={() => settle(false)}
                  aria-label="Cerrar"
                  className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-foreground p-0.5 -mr-1 -mt-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  ref={cancelRef}
                  onClick={() => settle(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                >
                  {opts.cancelLabel ?? 'Cancelar'}
                </button>
                <button
                  onClick={() => settle(true)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 ${
                    danger
                      ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500/50'
                      : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500/50'
                  }`}
                >
                  {opts.confirmLabel ?? 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmCtx.Provider>
  );
}

/**
 * Devuelve una función `confirm(opts | mensaje): Promise<boolean>`.
 * Sustituto directo de `window.confirm`. Si el proveedor no estuviera montado
 * (no debería ocurrir), resuelve `false` — la opción segura que NO ejecuta la
 * acción destructiva.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx);
  return ctx ?? (() => Promise.resolve(false));
}
