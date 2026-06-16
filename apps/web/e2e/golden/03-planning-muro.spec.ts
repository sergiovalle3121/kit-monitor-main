import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';

/**
 * Golden path · Planeación: publish a plan → see the WO on the Muro → Clear-to-Build.
 *
 * Note on the app's real wiring (confirmed in source): the Planning page's
 * "Publicar" explodes the BOM into a warehouse pick-list, while the Muro
 * ("Muro del plan" / production-plan) has its own "Publicar WO" that creates the
 * Work Order shown on the board with the Clear-to-Build semaphore. We cover both
 * legs honestly:
 *   - Test A: the Muro leg — publish a WO and see it on the board as Clear-to-Build.
 *   - Test B: the Planning leg — publish a plan and see it flip to "Publicado".
 */
test.describe('Golden path · Planeación + Muro', () => {
  test('publishes a WO on the Muro and sees it Clear-to-Build', async ({ page, context }) => {
    await installMockBackend(context); // board starts empty
    await loginAsMaster(context);

    await page.goto('/dashboard/production-plan');

    // Publish a WO for the seeded ACTIVE model (which has an active BOM + stock).
    await page.getByTestId('wo-publish-open').click();
    await page.getByTestId('wo-model-select').selectOption('AX-1000');
    await page.getByTestId('wo-publish-submit').click();

    // The WO appears on the Muro...
    const card = page.locator('[data-testid="wo-card"][data-model="AX-1000"]');
    await expect(card).toBeVisible();

    // ...and its Clear-to-Build semaphore reads "go" (green / "Clear to Build").
    const ctb = card.getByTestId('wo-ctb');
    await expect(ctb).toHaveAttribute('data-ctb-status', 'go');
    await expect(ctb).toContainText('Clear to Build');
  });

  test('publishes a plan in Planning and sees it become "Publicado"', async ({ page, context }) => {
    await installMockBackend(context);
    await loginAsMaster(context);

    await page.goto('/dashboard/planning');

    // Create a plan for the seeded model.
    await page.getByTestId('plan-new-btn').click();
    await page.getByTestId('plan-model-select').selectOption('AX-1000');
    await page.getByPlaceholder(/Unidades a producir/).fill('25');
    await page.getByTestId('plan-create-submit').click();

    // The new plan is pending → publish it.
    await page.getByTestId('plan-publish').click();

    // It flips to "Publicado" and exposes the post-publish actions.
    await expect(page.getByText('Publicado', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solicitar' })).toBeVisible();
  });
});
