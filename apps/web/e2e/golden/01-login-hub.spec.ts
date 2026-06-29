import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { masterSessionCookieValue } from '../fixtures/session';
import { OWNER_EMAIL, SESSION_COOKIE } from '../fixtures/constants';

/**
 * Golden path · Login Master → hub (not read-only).
 *
 * Drives the real login form. The /api/auth/login POST is stubbed to
 * authenticate the Master/owner and set the signed session cookie the
 * middleware + hub read — so we exercise the actual login → redirect → hub
 * wiring without a live backend.
 *
 * "Not read-only" is proven by reaching an /dashboard/admin route, which the
 * middleware bounces to ?blocked=admin for any non-admin (a read-only
 * demo/executive would be redirected there).
 */
test.describe('Golden path · Login Master → hub', () => {
  test.beforeEach(async ({ context }) => {
    await installMockBackend(context);
    await context.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'set-cookie': `${SESSION_COOKIE}=${masterSessionCookieValue()}; Path=/; HttpOnly; SameSite=Lax`,
        },
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'e2e-master',
            name: 'Master',
            email: OWNER_EMAIL,
            role: 'admin',
            position: null,
            status: 'active',
          },
        }),
      });
    });
  });

  test('Master logs in and lands in the hub with full (non read-only) access', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill(OWNER_EMAIL);
    await page.getByTestId('login-password').fill('master-pass');
    await page.getByTestId('login-submit').click();

    // Redirected into the hub, greeted by name.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Hola, Master\./ })).toBeVisible();

    // Navegación rail-primario: el Command rail (desktop) es la única fuente de
    // navegación; el owner ve TODAS las secciones/áreas del flujo desde el rail
    // (el home ya no duplica la rejilla de módulos).
    const rail = page.locator('aside[aria-label="Navegación principal por dominios"]');
    await expect(rail.getByRole('heading', { name: 'Diseño · NPI' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Product Master', exact: true })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Calidad', exact: true })).toBeVisible();

    // Not read-only: an admin-only route is reachable (non-admins get bounced
    // to /dashboard?blocked=admin by the middleware).
    await page.goto('/dashboard/admin/approvals');
    await expect(page).toHaveURL(/\/dashboard\/admin\/approvals/);
    await expect(page).not.toHaveURL(/blocked=admin/);
  });
});
