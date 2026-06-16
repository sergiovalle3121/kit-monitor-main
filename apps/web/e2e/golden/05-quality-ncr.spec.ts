import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';

/**
 * Golden path · Calidad: open the NCR cockpit → create an NCR → see its detail.
 */
test.describe('Golden path · Calidad (NCR cockpit)', () => {
  test.beforeEach(async ({ context }) => {
    await installMockBackend(context);
    await loginAsMaster(context);
  });

  test('creates an NCR from the cockpit and opens its detail', async ({ page }) => {
    await page.goto('/dashboard/quality');
    await expect(page.getByTestId('ncr-new-trigger')).toBeVisible();

    // Open the create modal and fill the required fields.
    await page.getByTestId('ncr-new-trigger').click();
    await page.getByTestId('ncr-field-partNumber').fill('PCB-E2E-001');
    await page.getByTestId('ncr-field-category').fill('Cosmético');
    await page.getByTestId('ncr-field-description').fill('Rayón en carcasa — lote E2E');
    await page.getByTestId('ncr-create-submit').click();

    // Wait for the create to settle: the modal closes and the list refreshes.
    // (Avoids racing the row click against the modal overlay / SWR re-render.)
    await expect(page.getByTestId('ncr-create-submit')).toBeHidden();

    // The new NCR appears as a row in the cockpit list.
    const row = page.getByTestId('ncr-row').first();
    await expect(row).toBeVisible();
    const ncrNumber = await row.getAttribute('data-ncr-number');
    expect(ncrNumber).toBeTruthy();

    // Open its detail and confirm it rendered.
    await row.click();
    await expect(page).toHaveURL(/\/dashboard\/quality\/ncr\/\d+/);
    await expect(page.getByTestId('ncr-detail')).toBeVisible();
    await expect(page.getByText(ncrNumber!, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('PCB-E2E-001', { exact: false }).first()).toBeVisible();
  });
});
