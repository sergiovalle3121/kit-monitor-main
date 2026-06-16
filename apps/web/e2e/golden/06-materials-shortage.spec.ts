import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';
import { API_ORIGIN } from '../fixtures/constants';

/**
 * Materiales · inventario → escasez.
 *
 * Extends the golden suite into the Inventario area (not covered by the baseline
 * mock): the Escasez tab derives actionable shortages from WO demand vs.
 * available stock and min/máx rules, and drills from a shortage back into that
 * part's Existencias. We layer the three Escasez endpoints on top of
 * installMockBackend (registered after it, so they win) and assert with semantic
 * locators (this page ships no data-testid).
 */

const json = (data: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

function position(part: string, onHand: number, extra: Record<string, unknown> = {}) {
  return {
    id: `pos-${part}`,
    partNumber: part,
    location: 'BULK',
    warehouseId: 'WH-01',
    warehouse: { name: 'Almacén 1' },
    // Keep the description free of the part number so getByText(part) stays unique.
    material: { description: 'Componente', uom: 'PCS' },
    onHand,
    allocated: 0,
    holdStatus: 'available',
    lotNumber: null,
    serialNumber: null,
    ...extra,
  };
}

test.describe('Materiales · inventario → escasez', () => {
  test('Escasez deriva faltantes (demanda vs disponible + min/máx) y enlaza a Existencias', async ({
    page,
    context,
  }) => {
    await installMockBackend(context);
    await loginAsMaster(context);

    // CAP: demanda WO 500 vs 100 disponible ⇒ faltante 400 (confirmado en línea).
    // RES: sin demanda, 50 on-hand ≤ min 200 ⇒ bajo mínimo.
    await context.route(`${API_ORIGIN}/inventory/positions`, (r) =>
      r.fulfill(json([position('CAP-0402-100NF', 100), position('RES-0603-10K', 50, { id: 'pos-res' })])),
    );
    await context.route(`${API_ORIGIN}/material-staging`, (r) =>
      r.fulfill(
        json([
          {
            id: 'stg-cap',
            woId: 'wo-1',
            woFolio: 'WO-1001',
            model: 'AX-1000',
            station: 'EST-1',
            part: 'CAP-0402-100NF',
            requiredQty: 500,
            stagedQty: 0,
            status: 'SHORTAGE',
          },
        ]),
      ),
    );
    await context.route(`${API_ORIGIN}/replenishment/rules`, (r) =>
      r.fulfill(
        json([
          {
            id: 'rule-res',
            partNumber: 'RES-0603-10K',
            warehouseId: 'WH-01',
            minStock: 200,
            maxStock: 1000,
            safetyStock: 50,
            priority: 'normal',
            isActive: true,
          },
        ]),
      ),
    );

    await page.goto('/dashboard/inventory');
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
    await expect(page.getByText('CAP-0402-100NF')).toBeVisible();

    await page.getByRole('button', { name: 'Escasez' }).click();
    await expect(page.getByText('Partes en escasez')).toBeVisible();
    await expect(page.getByText('Faltante total')).toBeVisible();
    await expect(page.getByText('faltante en línea', { exact: true })).toBeVisible();
    await expect(page.getByText('bajo mínimo', { exact: true })).toBeVisible();

    // The CAP row shows the −400 deficit.
    const capButton = page.getByRole('button', { name: 'CAP-0402-100NF', exact: true });
    const capRow = capButton.locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
    await expect(capRow).toContainText('400');
    await expect(capRow).toContainText('faltante en línea');

    // Drill from the shortage back into that part's Existencias (q pre-filled).
    await capButton.click();
    await expect(page.getByPlaceholder(/Buscar parte, descripci/)).toHaveValue('CAP-0402-100NF');
  });

  test('Existencias agrupa por parte y revela las ubicaciones al expandir', async ({ page, context }) => {
    await installMockBackend(context);
    await loginAsMaster(context);
    await context.route(`${API_ORIGIN}/inventory/positions`, (r) =>
      r.fulfill(
        json([
          position('PCB-2024-A', 40, { id: 'p1', location: 'A-01-01' }),
          position('PCB-2024-A', 10, { id: 'p2', location: 'A-02-03' }),
        ]),
      ),
    );

    await page.goto('/dashboard/inventory');
    await expect(page.getByText('PCB-2024-A')).toBeVisible();
    // The app pluralizes as "ubicaciónes" — match loosely.
    await expect(page.getByText(/2 ubicaci/)).toBeVisible();

    await page.getByRole('button', { name: /PCB-2024-A/ }).click();
    await expect(page.getByText('A-01-01')).toBeVisible();
    await expect(page.getByText('A-02-03')).toBeVisible();
  });
});
