import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';

/**
 * Golden path · Operador: open the station terminal, see the step + visual aid.
 *
 * The terminal needs a released WO (seeded) and a station code. Once a station
 * is entered, the context loads and the "Paso N · EST" badge and the visual-aid
 * image render — both served by the mocked backend over plain HTTP (no sockets).
 */
test.describe('Golden path · Terminal de operador', () => {
  test.beforeEach(async ({ context }) => {
    await installMockBackend(context, { seedWorkOrder: true });
    await loginAsMaster(context);
  });

  test('opens the station terminal and shows the step + visual aid', async ({ page }) => {
    await page.goto('/dashboard/operator-terminal');
    await expect(page.getByRole('heading', { name: /Terminal de operador/ })).toBeVisible();

    // Open the station (the WO auto-selects to the first released order).
    await page.getByTestId('station-input').fill('EST-10');

    // The step badge ("Paso N · EST-10") renders from the loaded context.
    const step = page.getByTestId('step-badge');
    await expect(step).toBeVisible();
    await expect(step).toContainText('Paso');
    await expect(step).toContainText('EST-10');

    // The visual aid for the step renders.
    await expect(page.getByText('Ayuda visual del paso')).toBeVisible();
    await expect(page.getByTestId('visual-aid-image')).toBeVisible();
  });
});
