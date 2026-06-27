'use client';

import { usePathname } from 'next/navigation';
import { useOperatorKiosk } from '@/lib/operatorChrome';

/**
 * Shell Taxonomy — fuente única de verdad del "tipo de cromo" por ruta.
 *
 * AXOS no debe vestir todas las rutas con la misma chrome. Esta clasificación
 * (documentada en `docs/design/AXOS_SHELL_TAXONOMY.md`) define cinco
 * experiencias y deja que el shell global y los widgets flotantes reaccionen
 * desde UN solo lugar, en vez de repartir `pathname.startsWith(...)` por cada
 * componente.
 *
 *  - `standard`        Listado/CRUD/operación administrativa. Chrome global
 *                      completo (topbar + wayfinding + dock).
 *  - `command-center`  Torre de control (dashboard, control-tower, analytics).
 *                      Hoy comparte el cromo `standard`; la distinción es
 *                      semántica/aditiva para fases siguientes.
 *  - `workbench`       Herramienta a pantalla completa (Office editor, CAD,
 *                      editores). Monta su propio frame y NO quiere dock ni
 *                      navegación flotante encima del lienzo.
 *  - `kiosk`           Piso de producción (Operator Terminal en modo Kiosko).
 *                      Sin cromo global; su propio topbar industrial manda.
 *  - `landing`         Fuera de `/dashboard` (landing/login). Sin cromo de app.
 *
 * El modo Kiosko es imperativo (lo activa el Operator Terminal vía
 * `operatorChrome`), por eso se combina aquí con la clasificación por pathname.
 */
export type ChromeMode =
  | 'standard'
  | 'command-center'
  | 'workbench'
  | 'kiosk'
  | 'landing';

/**
 * Rutas "bare": montan su propio layout a pantalla completa y no quieren NADA
 * del cromo del dashboard (ni topbar, ni wayfinding, ni dock). Mantener en sync
 * con los consumidores; antes vivía duplicado en `DashboardShell` y
 * `DashboardWayfinding`.
 */
export const BARE_PREFIXES = [
  '/dashboard/chat',
  '/dashboard/select-workspace',
] as const;

/**
 * Rutas workbench: editores a pantalla completa que portan su propio header y
 * salida. Hoy el editor de Office (`OfficeShell`, `fixed inset-0`) ya se monta
 * por encima del cromo global; declararlo aquí evita renderizar el dock debajo
 * del overlay y centraliza la decisión para los demás workbenches conforme se
 * migren (CAD, editores) en las fases siguientes.
 */
export const WORKBENCH_PREFIXES = ['/dashboard/office/'] as const;

export interface RouteChrome {
  /** Tipo de experiencia de la ruta actual. */
  mode: ChromeMode;
  /** ¿Está bajo el layout del dashboard? (false en landing/login). */
  inDashboard: boolean;
  /** No renderizar NINGÚN cromo global del dashboard (kiosko o ruta bare). */
  bare: boolean;
  /** El dock flotante inferior debe ocultarse (bare o workbench). */
  hideDock: boolean;
}

/** ¿La ruta es un editor workbench a pantalla completa? */
export function isWorkbenchPath(pathname: string | null | undefined): boolean {
  return !!pathname && WORKBENCH_PREFIXES.some((p) => pathname.startsWith(p));
}

/** ¿La ruta monta su propio layout full-screen (sin cromo del dashboard)? */
export function isBarePath(pathname: string | null | undefined): boolean {
  return !!pathname && BARE_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Hook reactivo que resuelve el cromo de la ruta actual combinando la
 * clasificación por pathname con el modo Kiosko imperativo. Un solo lugar para
 * que el shell decida qué montar.
 */
export function useRouteChrome(): RouteChrome {
  const pathname = usePathname() ?? '';
  const kiosk = useOperatorKiosk();

  const inDashboard = pathname.startsWith('/dashboard');
  const bareRoute = isBarePath(pathname);
  const workbench = isWorkbenchPath(pathname);

  let mode: ChromeMode;
  if (!inDashboard) mode = 'landing';
  else if (kiosk) mode = 'kiosk';
  else if (workbench) mode = 'workbench';
  else mode = 'standard';

  const bare = kiosk || bareRoute;

  return {
    mode,
    inDashboard,
    bare,
    hideDock: bare || workbench,
  };
}
