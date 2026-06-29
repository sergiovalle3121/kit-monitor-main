import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { installMockBackend } from "./fixtures/mock-backend";
import { loginAsMaster } from "./fixtures/session";
import {
  VIEWPORTS,
  THEMES,
  discoverRoutes,
  slugForRoute,
  domDetectors,
  type RouteResult,
  type Finding,
  type Severity,
} from "./visual-sweep/sweep-lib";

/**
 * Systematic visual + navigation sweep (Section 5 of the UX polish pass).
 *
 * Walks every static app route in desktop (1440) and mobile (390), in light and
 * dark themes, screenshots each, and runs DOM detectors + axe-core. Results land
 * in e2e/__visual__/ (screenshots + visual-findings.json, sorted by severity).
 *
 * It is OPT-IN: it only defines tests when SWEEP=1 so the golden suite stays
 * fast. Run it against a built+started server (fast) or the dev server:
 *
 *   SWEEP=1 npx playwright test visual-sweep.spec.ts
 *
 * Optional env: SWEEP_LIMIT=N (first N routes), SWEEP_ROUTES=/a,/b (only these),
 * SWEEP_VIEWPORTS=desktop|mobile, SWEEP_THEMES=light|dark, AXE=0 (skip axe).
 */

const OUT_DIR = join(process.cwd(), "e2e", "__visual__");
const SHOTS_DIR = join(OUT_DIR, "screenshots");

const allResults: RouteResult[] = [];

function axePath(): string | null {
  const candidates = [
    join(process.cwd(), "node_modules", "axe-core", "axe.min.js"),
    join(process.cwd(), "..", "..", "node_modules", "axe-core", "axe.min.js"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

const IMPACT_TO_SEVERITY: Record<string, Severity> = {
  critical: "high",
  serious: "high",
  moderate: "medium",
  minor: "low",
};

if (process.env.SWEEP) {
  const limit = process.env.SWEEP_LIMIT ? parseInt(process.env.SWEEP_LIMIT, 10) : undefined;
  const onlyRoutes = process.env.SWEEP_ROUTES?.split(",").map((s) => s.trim()).filter(Boolean);
  const viewports = VIEWPORTS.filter(
    (v) => !process.env.SWEEP_VIEWPORTS || process.env.SWEEP_VIEWPORTS.split(",").includes(v.name),
  );
  const themes = THEMES.filter(
    (t) => !process.env.SWEEP_THEMES || process.env.SWEEP_THEMES.split(",").includes(t),
  );
  const useAxe = process.env.AXE !== "0";

  let routes = onlyRoutes && onlyRoutes.length ? onlyRoutes : discoverRoutes();
  if (limit) routes = routes.slice(0, limit);

  test.describe("Visual sweep", () => {
    test.describe.configure({ mode: "serial", timeout: 25 * 60 * 1000 });

    test.beforeEach(async ({ context }) => {
      await installMockBackend(context);
      await loginAsMaster(context);
    });

    for (const vp of viewports) {
      for (const theme of themes) {
        test(`${vp.name} · ${theme} · ${routes.length} routes`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.emulateMedia({ colorScheme: theme });
          await page.addInitScript((t) => {
            try {
              window.localStorage.setItem("axos_theme", t as string);
            } catch {
              /* storage may be unavailable */
            }
          }, theme);

          const dir = join(SHOTS_DIR, `${vp.name}-${theme}`);
          mkdirSync(dir, { recursive: true });

          const axe = useAxe ? axePath() : null;

          for (const route of routes) {
            const result: RouteResult = {
              route,
              viewport: vp.name,
              theme,
              screenshot: "",
              findings: [],
            };
            try {
              await page.goto(route, { waitUntil: "domcontentloaded", timeout: 25000 });
              await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
              // Let the first paint + theme class settle (no networkidle: socket.io
              // keeps a long-lived connection that never goes idle).
              await page.waitForTimeout(900);

              const slug = slugForRoute(route);
              const shot = join(dir, `${slug}.png`);
              await page.screenshot({ path: shot }).catch(() => {});
              result.screenshot = shot.replace(process.cwd() + "/", "");

              // DOM detectors (serialized into the page).
              const dom = (await page.evaluate(domDetectors).catch(() => [])) as Finding[];
              result.findings.push(...dom);

              // axe-core (best-effort).
              if (axe) {
                try {
                  await page.addScriptTag({ path: axe });
                  const res = (await page.evaluate(async () => {
                    // @ts-expect-error injected global
                    return await window.axe.run(document, {
                      resultTypes: ["violations"],
                      runOnly: {
                        type: "rule",
                        values: [
                          "color-contrast",
                          "image-alt",
                          "button-name",
                          "link-name",
                          "label",
                          "aria-hidden-focus",
                          "duplicate-id-active",
                        ],
                      },
                    });
                  })) as { violations: { id: string; impact?: string; nodes: { target: string[] }[]; help: string }[] };
                  for (const v of res.violations || []) {
                    result.findings.push({
                      type: `axe:${v.id}`,
                      severity: IMPACT_TO_SEVERITY[v.impact || "moderate"] || "medium",
                      detail: `${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
                      selector: v.nodes[0]?.target?.join(" ") ?? undefined,
                    });
                  }
                } catch {
                  /* axe failed on this route — keep DOM findings */
                }
              }
            } catch (err) {
              result.error = err instanceof Error ? err.message : String(err);
              result.findings.push({
                type: "navigation-error",
                severity: "high",
                detail: result.error,
              });
            }
            allResults.push(result);
          }

          expect(allResults.length).toBeGreaterThan(0);
        });
      }
    }

    test.afterAll(async () => {
      const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
      // Flatten + sort findings by severity for the report.
      const flat = allResults
        .flatMap((r) =>
          r.findings.map((f) => ({
            route: r.route,
            viewport: r.viewport,
            theme: r.theme,
            ...f,
          })),
        )
        .sort((a, b) => order[a.severity] - order[b.severity]);

      const byType: Record<string, number> = {};
      const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
      for (const f of flat) {
        byType[f.type] = (byType[f.type] || 0) + 1;
        bySeverity[f.severity] += 1;
      }

      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        join(OUT_DIR, "visual-findings.json"),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            routesSwept: new Set(allResults.map((r) => r.route)).size,
            combinations: allResults.length,
            summary: { bySeverity, byType },
            findings: flat,
            results: allResults,
          },
          null,
          2,
        ),
      );
      console.log(
        `[visual-sweep] ${allResults.length} combos · high=${bySeverity.high} medium=${bySeverity.medium} low=${bySeverity.low} → e2e/__visual__/visual-findings.json`,
      );
    });
  });
}
