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
let workbench = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Activa/desactiva el modo Kiosko. Idempotente. */
export function setOperatorKiosk(next: boolean) {
  if (kiosk === next) return;
  kiosk = next;
  emit();
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

/**
 * Modo Workbench **imperativo**. Algunos editores a pantalla completa (el CAD
 * `Layout3DEditor`, por ejemplo) se montan condicionalmente DENTRO de una ruta
 * `standard` (la pestaña CAD de `/dashboard/line-engineering`), así que no se
 * pueden declarar por pathname. Mientras están abiertos activan este flag para
 * que el shell oculte el dock y los widgets flotantes (que hoy quedan ENCIMA del
 * lienzo del editor), y lo restablecen al cerrarse.
 *
 * Vive en el mismo store que el Kiosko porque resuelve el mismo problema (ocultar
 * cromo global desde una capa distinta al layout) y NO es una fuente de tema: el
 * tema sigue siendo único (ThemeProvider → `.dark` en <html>).
 */
export function setWorkbenchChrome(next: boolean) {
  if (workbench === next) return;
  workbench = next;
  emit();
}

/** Lee el modo Workbench imperativo de forma reactiva. SSR arranca en `false`. */
export function useWorkbenchChrome(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => workbench,
    () => false,
  );
}
