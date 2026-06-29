import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installMockBackend } from './fixtures/mock-backend';
import { loginAsMaster } from './fixtures/session';
import { filteredRoutes, routeSlug, type SweepRoute } from './visual-sweep/routes';
import { domDetectors, type DomFinding, type Severity } from './visual-sweep/detectors';

/**
 * BARRIDO VISUAL — Fase 3.
 *
 * Itera las rutas del app (ver `visual-sweep/routes.ts`), logueado como Master
 * con el backend mockeado en la frontera de red (hermético, sin DB). Por cada
 * ruta toma screenshots a desktop/móvil en tema claro/oscuro, abre colapsables y
 * dropdowns, y corre detectores DOM (`visual-sweep/detectors.ts`) + axe-core
 * (contraste WCAG AA). Vuelca screenshots a `e2e/__visual__/` y un
 * `visual-findings.json` ordenado por severidad.
 *
 * Parametrizable por entorno (para correr por tandas sin saturar memoria):
 *   SWEEP_ONLY=<regex>   sólo rutas que casan
 *   SWEEP_SKIP=<regex>   excluye rutas que casan
 *   SWEEP_MAX=<n>        límite de rutas
 *   SWEEP_THEMES=light,dark         (default ambos)
 *   SWEEP_INTERACT=0|1   abrir colapsables/dropdowns (default 1)
 */

const OUT_DIR = path.resolve(__dirname, '__visual__');
const FINDINGS_PATH = path.join(OUT_DIR, 'visual-findings.json');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const THEMES = (process.env.SWEEP_THEMES ?? 'light,dark').split(',') as ('light' | 'dark')[];
const INTERACT = process.env.SWEEP_INTERACT !== '0';

/**
 * Opt-in: el barrido es pesado (113 rutas × temas × viewports), así que NO corre
 * en el `npm run e2e` por defecto. Se habilita con `SWEEP=1` o con cualquier
 * filtro `SWEEP_ONLY/SKIP/MAX`. Así la suite golden sigue rápida.
 */
const SWEEP_ENABLED = !!(
  process.env.SWEEP ||
  process.env.SWEEP_ONLY ||
  process.env.SWEEP_SKIP ||
  process.env.SWEEP_MAX
);
const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

interface SweepFinding extends DomFinding {
  route: string;
  url: string;
  theme: 'light' | 'dark';
  viewport: 'desktop' | 'mobile';
  state: string;
  screenshot: string;
}

const ALL_FINDINGS: SweepFinding[] = [];
const VISITED: { route: string; url: string; ok: boolean; error?: string }[] = [];

fs.mkdirSync(OUT_DIR, { recursive: true });

const routes = filteredRoutes();

/** Navegación tolerante: no usa networkidle (socket.io mantiene conexiones). */
async function safeGoto(page: Page, url: string): Promise<string | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(500); // breve asentamiento de render (sweep visual)
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function shot(page: Page, name: string): Promise<string> {
  const file = path.join(OUT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, animations: 'disabled' });
  } catch {
    /* algunas rutas con canvas/webgl pueden fallar el screenshot: lo registramos vacío */
  }
  return path.relative(path.resolve(__dirname, '..'), file);
}

async function detect(
  page: Page,
  route: SweepRoute,
  theme: 'light' | 'dark',
  viewport: 'desktop' | 'mobile',
  state: string,
  screenshot: string,
): Promise<void> {
  const vp = page.viewportSize() ?? DESKTOP;
  let dom: DomFinding[] = [];
  try {
    dom = await page.evaluate(domDetectors, { w: vp.width, h: vp.height });
  } catch {
    /* noop */
  }
  for (const f of dom) {
    ALL_FINDINGS.push({ ...f, route: route.template, url: route.url, theme, viewport, state, screenshot });
  }

  // axe-core: sólo contraste, para no inflar la corrida.
  try {
    // `@axe-core/playwright` tipa `page` contra su propia copia de playwright-core;
    // los objetos en runtime son idénticos, así que casteamos el arg del constructor.
    const res = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0])
      .withRules(['color-contrast'])
      .analyze();
    for (const v of res.violations) {
      for (const node of v.nodes.slice(0, 8)) {
        ALL_FINDINGS.push({
          type: 'invisible-text',
          severity: 'medium',
          message: `axe color-contrast: ${node.failureSummary?.split('\n')[0] ?? v.help}`,
          selector: Array.isArray(node.target) ? node.target.join(' ') : String(node.target),
          route: route.template,
          url: route.url,
          theme,
          viewport,
          state,
          screenshot,
        });
      }
    }
  } catch {
    /* axe puede fallar en páginas con iframes/canvas; se ignora */
  }
}

/** Expande colapsables y abre el primer dropdown para capturar estados abiertos. */
async function interact(page: Page): Promise<string[]> {
  const states: string[] = [];
  try {
    const collapsibles = page.locator('button[aria-expanded="false"]');
    const n = Math.min(await collapsibles.count(), 12);
    let expanded = 0;
    for (let i = 0; i < n; i++) {
      try {
        await collapsibles.nth(i).click({ timeout: 1500 });
        expanded++;
      } catch {
        /* algunos no son colapsables (combobox que navega); se omite */
      }
    }
    if (expanded > 0) states.push('expanded');
  } catch {
    /* noop */
  }
  try {
    // Cualquier disparador de popover (menu/dialog/listbox/true): cubre tanto los
    // menús ad-hoc como los primitivos `Popover`/`DropdownMenu` compartidos.
    const trigger = page.locator('[aria-haspopup]').first();
    if (await trigger.count()) {
      await trigger.click({ timeout: 1500 });
      await page.waitForTimeout(200);
      states.push('dropdown-open');
    }
  } catch {
    /* noop */
  }
  return states;
}

test.describe.configure({ mode: 'serial' });

test.describe('Barrido visual', () => {
  test.skip(!SWEEP_ENABLED, 'Barrido deshabilitado: usa SWEEP=1 (o SWEEP_ONLY/SKIP/MAX) para correrlo.');
  for (const route of routes) {
    test(`sweep ${route.template}`, async ({ browser }) => {
      let anyOk = false;
      for (const theme of THEMES) {
        const context = await browser.newContext({ viewport: DESKTOP });
        await installMockBackend(context);
        await loginAsMaster(context);
        await context.addInitScript((t) => {
          try {
            window.localStorage.setItem('axos_theme', t);
            if (t === 'dark') document.documentElement.classList.add('dark');
          } catch {
            /* ignore */
          }
        }, theme);

        const page = await context.newPage();
        const err = await safeGoto(page, route.url);
        if (err) {
          VISITED.push({ route: route.template, url: route.url, ok: false, error: err });
          await context.close();
          continue;
        }
        anyOk = true;

        // Desktop, estado inicial.
        const base = routeSlug(route.url);
        let s = await shot(page, `${base}__${theme}__desktop`);
        await detect(page, route, theme, 'desktop', 'initial', s);

        // Estados abiertos (sólo desktop, ambos temas) — colapsables + dropdown.
        if (INTERACT) {
          const states = await interact(page);
          for (const st of states) {
            s = await shot(page, `${base}__${theme}__desktop__${st}`);
            await detect(page, route, theme, 'desktop', st, s);
          }
        }

        // Móvil, estado inicial.
        await page.setViewportSize(MOBILE);
        await page.waitForTimeout(200);
        s = await shot(page, `${base}__${theme}__mobile`);
        await detect(page, route, theme, 'mobile', 'initial', s);

        await context.close();
      }
      VISITED.push({ route: route.template, url: route.url, ok: anyOk });
      expect(anyOk, `la ruta ${route.url} debe cargar en al menos un tema`).toBeTruthy();
    });
  }
});

test.afterAll(async () => {
  if (!SWEEP_ENABLED) return;
  ALL_FINDINGS.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  const counts = ALL_FINDINGS.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});
  const byType = ALL_FINDINGS.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] ?? 0) + 1;
    return acc;
  }, {});
  const summary = {
    generatedRoutes: routes.length,
    visited: VISITED,
    totals: { findings: ALL_FINDINGS.length, bySeverity: counts, byType },
    findings: ALL_FINDINGS,
  };
  fs.writeFileSync(FINDINGS_PATH, JSON.stringify(summary, null, 2));
  console.log(
    `\n[visual-sweep] ${routes.length} rutas · ${ALL_FINDINGS.length} hallazgos ` +
      `(high ${counts.high ?? 0} / medium ${counts.medium ?? 0} / low ${counts.low ?? 0}) → ${FINDINGS_PATH}`,
  );
});
