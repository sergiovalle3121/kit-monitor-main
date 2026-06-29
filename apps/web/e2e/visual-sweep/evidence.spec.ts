import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { installMockBackend } from "../fixtures/mock-backend";
import { loginAsMaster } from "../fixtures/session";

/**
 * Targeted evidence for the Section-4 fixes (opt-in: EVIDENCE=1). Captures the
 * INTERACTIVE states the route sweep can't (open breadcrumb menu, open CAD,
 * open mobile nav) and asserts the fix held, dropping screenshots under
 * e2e/__visual__/report/ for the PR.
 *
 *   EVIDENCE=1 npx playwright test visual-sweep/evidence.spec.ts
 */
const REPORT = join(process.cwd(), "e2e", "__visual__", "report");

if (process.env.EVIDENCE) {
  test.describe("UX fix evidence", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ context }) => {
      await installMockBackend(context);
      await loginAsMaster(context);
      mkdirSync(REPORT, { recursive: true });
    });

    test("breadcrumb section menu is opaque + on top (portal)", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/dashboard/quality/holds", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);

      const trigger = page.locator('nav[aria-label="Ruta de navegación"] button[aria-haspopup="menu"]').first();
      await expect(trigger).toBeVisible();
      await trigger.click();

      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();

      // Opaque surface (alpha ~1) — the breadcrumb menu must not read through.
      const alpha = await menu.evaluate((el) => {
        const c = getComputedStyle(el).backgroundColor;
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return 1;
        const p = m[1].split(",").map((x) => parseFloat(x.trim()));
        return p[3] === undefined ? 1 : p[3];
      });
      expect(alpha).toBeGreaterThan(0.98);

      // Portaled to <body> (escapes the translucent breadcrumb bar).
      const parentIsBody = await menu.evaluate((el) => el.parentElement === document.body);
      expect(parentIsBody).toBe(true);

      await page.screenshot({ path: join(REPORT, "after-breadcrumb-menu-opaque.png") });
    });

    test("CAD has a persistent, in-viewport exit (no trap)", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/dashboard/line-engineering", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);

      // Open the CAD tab (mounts the full-screen editor).
      await page.getByRole("button", { name: /CAD/ }).first().click();

      const exit = page.getByRole("button", { name: "Salir del CAD" });
      await expect(exit).toBeVisible();

      // The exit must be INSIDE the viewport (the old trailing × got clipped).
      const box = await exit.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(1440);
        expect(box.y).toBeGreaterThanOrEqual(0);
      }

      await page.screenshot({ path: join(REPORT, "after-cad-exit-visible.png") });

      // And it actually exits back to the balance view.
      await exit.click();
      await expect(page.getByRole("button", { name: "Salir del CAD" })).toHaveCount(0);
    });

    test("mobile nav sheet reaches every module", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);

      const menuBtn = page.getByRole("button", { name: "Abrir navegación" });
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();

      const sheet = page.getByRole("dialog", { name: "Navegación" });
      await expect(sheet).toBeVisible();
      // A deep module (only reachable by browsing) is present in the sheet.
      await expect(sheet.getByRole("link", { name: "Genealogía", exact: true })).toBeVisible();

      await page.screenshot({ path: join(REPORT, "after-mobile-nav-sheet.png") });
    });
  });
}
