import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';

/**
 * Golden path · NPI: create model → BOM → activate.
 *
 * Starts at the model master, creates a fresh DRAFT model, gives it a BOM line,
 * then activates it and asserts the status pill flips to "Activo".
 */
test.describe('Golden path · NPI (model → BOM → activate)', () => {
  test.beforeEach(async ({ context }) => {
    await installMockBackend(context);
    await loginAsMaster(context);
  });

  test('creates a model, adds a BOM line and activates it', async ({ page }) => {
    await page.goto('/dashboard/models');
    await expect(page.getByRole('heading', { name: /Modelos · NPI/ })).toBeVisible();

    // Create a new DRAFT model.
    await page.getByRole('button', { name: 'Nuevo modelo' }).click();
    await page.getByPlaceholder(/Controlador EV/).fill('E2E NPI Controller');
    await page.getByPlaceholder(/MDL/).fill('MDL-E2E-NPI');
    await page.getByRole('button', { name: 'Crear modelo' }).click();

    // Landed on the model detail page in DRAFT.
    await expect(page).toHaveURL(/\/dashboard\/models\/mdl-e2e-/);
    await expect(page.getByTestId('model-status-pill')).toHaveText(/Borrador/);

    // Create the BOM, then add a component line.
    await page.getByTestId('bom-create-btn').click();
    await page.getByTestId('bom-part-input').fill('CMP-NPI-1');
    await page.getByTestId('bom-qty-input').fill('3');
    await page.getByTestId('bom-add-btn').click();
    await expect(
      page.getByTestId('bom-component-row').filter({ hasText: 'CMP-NPI-1' }),
    ).toBeVisible();

    // Activate the model → status becomes "Activo".
    await page.getByTestId('model-activate-btn').click();
    await expect(page.getByTestId('model-status-pill')).toHaveText(/Activo/);
  });
});
