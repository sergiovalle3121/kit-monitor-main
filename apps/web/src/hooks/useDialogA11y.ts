'use client';

import { useEffect, useRef } from 'react';

/**
 * Accesibilidad para diálogos modales, extraída del patrón de `ConfirmDialog`
 * para reutilizarla en los `Modal` ad-hoc de cada lane (calidad, shipping,
 * mantenimiento, tráfico, usuarios, line-engineering, …) que hoy no atrapan el
 * foco ni cierran con Escape.
 *
 * Devuelve un `ref` que se monta en el PANEL del diálogo (no en el overlay) y se
 * encarga de:
 *  - Foco inicial en el primer control enfocable (o el panel si no hay ninguno).
 *  - `Escape` cierra (llama a `onClose`).
 *  - `Tab`/`Shift+Tab` atrapan el foco dentro del panel (ciclo first↔last).
 *  - Al desmontar, restaura el foco al elemento que lo tenía antes de abrir.
 *
 * El panel debe llevar además `role="dialog"`, `aria-modal="true"`,
 * `aria-labelledby` (id del título) y `tabIndex={-1}` para ser foco de respaldo.
 *
 * `onClose` se guarda en un ref para que el efecto se monte UNA sola vez: así un
 * `onClose={() => setOpen(false)}` en línea (que cambia en cada render) no vuelve
 * a robar el foco en cada repintado.
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
) {
  const panelRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  // Latest-ref: mantener fresco onClose sin re-montar el efecto principal (y sin
  // mutar el ref en render, que React desaconseja).
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusables = (): HTMLElement[] =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Foco inicial: primer control, o el propio panel como respaldo.
    (getFocusables()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = getFocusables();
      if (f.length === 0) {
        // Sin controles: mantener el foco en el panel.
        e.preventDefault();
        panel?.focus();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restaura el foco a donde estaba antes de abrir el diálogo.
      previouslyFocused?.focus?.();
    };
    // Montaje único: solo usa refs (estables), así que [] es correcto.
  }, []);

  return panelRef;
}
