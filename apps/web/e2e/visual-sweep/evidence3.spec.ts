import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { installMockBackend } from "../fixtures/mock-backend";
import { loginAsMaster } from "../fixtures/session";

/**
 * Capture-only evidence for the "polish the app from the inside" pass
 * (opt-in: EVIDENCE3=1). Authenticated owner + mock backend, so the core
 * surfaces render with real data. Light + dark on desktop; a couple on mobile.
 */
const REPORT = join(process.cwd(), "e2e", "__visual__", "report3");

const SURFACES: { slug: string; path: string }[] = [
  { slug: "home", path: "/dashboard" },
  { slug: "mission-control", path: "/dashboard/mission-control" },
  { slug: "erp", path: "/dashboard/erp" },
  { slug: "operador", path: "/dashboard/operador" },
  { slug: "inventory", path: "/dashboard/inventory" },
  { slug: "quality", path: "/dashboard/quality" },
  // hubs that had the invisible icon-tile bug (verify the fix)
  { slug: "finance", path: "/dashboard/finance" },
  { slug: "metrics", path: "/dashboard/metrics" },
  { slug: "industrial-engineering", path: "/dashboard/industrial-engineering" },
];

async function settle(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
}

if (process.env.EVIDENCE3) {
  test.describe("inside polish — capture", () => {
    test.describe.configure({ mode: "serial" });

    test.beforeEach(async ({ context }) => {
      await installMockBackend(context);
      await loginAsMaster(context);
      mkdirSync(REPORT, { recursive: true });
    });

    test("desktop core surfaces — light + dark", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      for (const s of SURFACES) {
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto(s.path, { waitUntil: "domcontentloaded" });
        await settle(page);
        await page.screenshot({ path: join(REPORT, `${s.slug}-desk-light.png`), fullPage: true });
        await page.emulateMedia({ colorScheme: "dark" });
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(REPORT, `${s.slug}-desk-dark.png`), fullPage: true });
      }
    });

    test("mobile spot-check — home + operador + erp", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const slug of ["home", "operador", "erp"]) {
        const s = SURFACES.find((x) => x.slug === slug)!;
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto(s.path, { waitUntil: "domcontentloaded" });
        await settle(page);
        await page.screenshot({ path: join(REPORT, `${s.slug}-mob-light.png`), fullPage: true });
        await page.emulateMedia({ colorScheme: "dark" });
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(REPORT, `${s.slug}-mob-dark.png`), fullPage: true });
      }
    });
  });
}
