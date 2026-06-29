import fs from 'node:fs';
import path from 'node:path';

/**
 * Enumeración de rutas para el barrido visual.
 *
 * Recorre `src/app/**​/page.tsx` y deriva la URL navegable de cada ruta:
 *  - quita los grupos `(grupo)` (no afectan la URL),
 *  - sustituye los segmentos dinámicos `[param]` / `[...param]` por valores
 *    demo (ver SUBSTITUTIONS) para que el barrido pueda visitarlas,
 *  - omite `src/app/api` y carpetas privadas `_xxx`.
 *
 * El resultado es determinista (orden alfabético) para que los nombres de
 * archivo de screenshot sean estables entre corridas (antes/después).
 */

const APP_DIR = path.resolve(__dirname, '../../src/app');

/** Valor demo por nombre de parámetro dinámico. */
const PARAM_DEFAULTS: Record<string, string> = {
  id: '1',
  code: 'DEMO',
  key: 'demo',
  slug: 'demo',
};

/**
 * Overrides por plantilla de ruta cuando el backend mock tiene una entidad
 * sembrada conocida (modelo `AX-1000`), para que la página renderice datos en
 * vez de un estado vacío.
 */
const ROUTE_OVERRIDES: Record<string, string> = {
  '/dashboard/models/[id]': '/dashboard/models/AX-1000',
  '/dashboard/bom/[id]': '/dashboard/bom/AX-1000',
  '/dashboard/npi/[id]': '/dashboard/npi/AX-1000',
};

export interface SweepRoute {
  /** Plantilla original (con `[param]`), útil para reportar. */
  template: string;
  /** URL navegable (con sustituciones aplicadas). */
  url: string;
  /** ¿Tiene segmentos dinámicos? (datos demo, render best-effort). */
  dynamic: boolean;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'api' || entry.name.startsWith('_')) continue;
      walk(path.join(dir, entry.name), acc);
    } else if (entry.name === 'page.tsx') {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

function fileToTemplate(file: string): string {
  const rel = path.relative(APP_DIR, path.dirname(file));
  if (rel === '') return '/';
  const segments = rel
    .split(path.sep)
    .filter((s) => !(s.startsWith('(') && s.endsWith(')'))); // grupos no afectan la URL
  return '/' + segments.join('/');
}

function substitute(template: string): { url: string; dynamic: boolean } {
  if (ROUTE_OVERRIDES[template]) return { url: ROUTE_OVERRIDES[template], dynamic: true };
  let dynamic = false;
  const url = template
    .split('/')
    .map((seg) => {
      const m = seg.match(/^\[\.{0,3}(.+?)\]$/);
      if (!m) return seg;
      dynamic = true;
      return PARAM_DEFAULTS[m[1]] ?? '1';
    })
    .join('/');
  return { url, dynamic };
}

/** Todas las rutas navegables del app, ordenadas de forma estable. */
export function enumerateRoutes(): SweepRoute[] {
  const files = walk(APP_DIR);
  const routes = files.map((file) => {
    const template = fileToTemplate(file);
    const { url, dynamic } = substitute(template);
    return { template, url, dynamic };
  });
  routes.sort((a, b) => a.template.localeCompare(b.template));
  return routes;
}

/**
 * Aplica los filtros de entorno del barrido:
 *  - SWEEP_ONLY: subcadena/regex; sólo rutas cuya plantilla coincide.
 *  - SWEEP_SKIP: subcadena/regex; excluye rutas cuya plantilla coincide.
 *  - SWEEP_MAX: límite de cantidad (tras filtrar).
 */
export function filteredRoutes(): SweepRoute[] {
  let routes = enumerateRoutes();
  const only = process.env.SWEEP_ONLY;
  const skip = process.env.SWEEP_SKIP;
  const max = process.env.SWEEP_MAX ? parseInt(process.env.SWEEP_MAX, 10) : undefined;

  if (only) {
    const re = new RegExp(only);
    routes = routes.filter((r) => re.test(r.template) || re.test(r.url));
  }
  if (skip) {
    const re = new RegExp(skip);
    routes = routes.filter((r) => !(re.test(r.template) || re.test(r.url)));
  }
  if (max && Number.isFinite(max)) routes = routes.slice(0, max);
  return routes;
}

/** Nombre de archivo seguro derivado de la URL (para screenshots). */
export function routeSlug(url: string): string {
  const s = url.replace(/^\//, '').replace(/[/]/g, '__').replace(/[^a-zA-Z0-9._-]/g, '-');
  return s || 'root';
}
