import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { installMockBackend } from "../fixtures/mock-backend";
import { loginAsMaster } from "../fixtures/session";

/** Evidence for the 2nd polish pass (opt-in: EVIDENCE2=1). */
const REPORT = join(process.cwd(), "e2e", "__visual__", "report2");

if (process.env.EVIDENCE2) {
  test.describe("UX pass 2 evidence", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ context }) => {
      await installMockBackend(context);
      await loginAsMaster(context);
      mkdirSync(REPORT, { recursive: true });
    });

    test("home is full-screen; Axos OS toggles the nav drawer", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(REPORT, "home-fullscreen.png") });

      const toggle = page.getByRole("button", { name: "Abrir navegación" });
      await expect(toggle).toBeVisible();
      await toggle.click();
      const drawer = page.getByRole("dialog", { name: "Navegación" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Calidad", exact: true })).toBeVisible();
      await page.waitForTimeout(450); // let the slide-in settle before the shot
      await page.screenshot({ path: join(REPORT, "nav-drawer-open.png") });

      // Toggle closes from the same button (now "Cerrar navegación").
      await page.getByRole("button", { name: "Cerrar navegación" }).first().click();
      await expect(page.getByRole("dialog", { name: "Navegación" })).toHaveCount(0);
    });

    test("search palette is simplified with a clear close", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("axos:open-search")));
      const dialog = page.getByRole("dialog", { name: "Buscar y navegar" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Cerrar búsqueda" })).toBeVisible();
      await page.screenshot({ path: join(REPORT, "search-simplified.png") });
    });

    test("messaging opens full-screen and toggles closed from the same button", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      const btn = page.getByRole("button", { name: "Abrir mensajería" });
      await expect(btn).toBeVisible();
      await btn.click();
      const panel = page.getByRole("dialog", { name: "Mensajería" });
      await expect(panel).toBeVisible();
      // Full-screen: panel covers the viewport.
      const box = await panel.boundingBox();
      expect(box?.width).toBeGreaterThan(1380);
      expect(box?.height).toBeGreaterThan(840);
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(REPORT, "chat-fullscreen.png") });
      // Same floating button now closes it.
      await page.getByRole("button", { name: "Cerrar mensajería" }).click();
      await expect(page.getByRole("dialog", { name: "Mensajería" })).toHaveCount(0);
    });

    test("CAD has a clear Cerrar (X) button", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/dashboard/line-engineering", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /CAD/ }).first().click();
      const close = page.getByRole("button", { name: "Cerrar el CAD" });
      await expect(close).toBeVisible();
      const box = await close.boundingBox();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(1440);
      }
      await page.screenshot({ path: join(REPORT, "cad-cerrar.png") });
    });
  });
}
