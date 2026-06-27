import { useSyncExternalStore } from 'react';

/**
 * Estado compartido del "modo Kiosko" del Operator Terminal.
 *
 * El terminal del operador (/dashboard/operador) tiene su propio chrome
 * industrial (topbar + barra de acciones). En modo Kiosko ocultamos el chrome
 * GLOBAL de AXOS (topbar, wayfinding, dock) y los widgets flotantes (mensajería,
 * Cide) para una vista enfocada de línea, sin capas compitiendo encima de las
 * acciones críticas.
 *
 * Se modela como un store externo mínimo (sin dependencias, sin provider nuevo)
 * porque el chrome global vive en dos capas distintas: `DashboardShell`
 * (layout de dashboard) y `ChatWidget`/`Cide` (layout raíz). Un store de módulo
 * leído con `useSyncExternalStore` deja que ambas capas reaccionen sin
 * reestructurar los layouts. NO es una segunda fuente de tema: el tema sigue
 * siendo único (ThemeProvider → `.dark` en <html>).
 */

let kiosk = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Activa/desactiva el modo Kiosko. Idempotente. */
export function setOperatorKiosk(next: boolean) {
  if (kiosk === next) return;
  kiosk = next;
  listeners.forEach((l) => l());
}

/** Lee el modo Kiosko de forma reactiva. SSR siempre arranca en `false` para
 *  no romper la hidratación (el chrome global se renderiza en el primer paint). */
export function useOperatorKiosk(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => kiosk,
    () => false,
  );
}
