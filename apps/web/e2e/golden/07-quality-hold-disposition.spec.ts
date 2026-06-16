import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';
import { API_ORIGIN } from '../fixtures/constants';

/**
 * Calidad · disposición de hold (inventory-level).
 *
 * Complements the NCR cockpit (05) with the inventory hold → disposition
 * lifecycle: from an active hold, propose a disposition, then approve and
 * execute it. We layer a small stateful router for /quality/** on top of
 * installMockBackend so the create/approve/execute transitions are reflected on
 * the SWR re-fetch — exercising the real proponer → aprobar → ejecutar flow.
 */

interface Dispo {
  id: number;
  type: string;
  status: string;
  partNumber: string;
  warehouseId: string;
  location: string;
  quantity: number;
  reason: string;
  proposedBy: string;
  createdAt: string;
}

test.describe('Calidad · disposición de hold', () => {
  test('propone, aprueba y ejecuta la disposición de un hold de inventario', async ({ page, context }) => {
    await installMockBackend(context);
    await loginAsMaster(context);

    const holds = [
      {
        id: 10,
        partNumber: 'PCB-2024-A',
        level: 'PART_NUMBER',
        levelValue: null,
        isActive: true,
        reason: 'Sospecha de contaminación',
        heldBy: 'qa@axos.test',
        createdAt: new Date().toISOString(),
      },
    ];
    const dispositions: Dispo[] = [];
    let nextId = 100;

    await context.route(`${API_ORIGIN}/quality/**`, async (route) => {
      const req = route.request();
      const method = req.method().toUpperCase();
      const path = new URL(req.url()).pathname;
      const send = (data: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

      if (path === '/quality/holds/active') return send(holds);
      if (path === '/quality/transfers') return send([]);
      if (path === '/quality/dispositions' && method === 'GET') return send(dispositions);
      if (path === '/quality/dispositions' && method === 'POST') {
        const b = (req.postDataJSON() ?? {}) as Record<string, unknown>;
        const d: Dispo = {
          id: ++nextId,
          type: (b.type as string) || 'scrap',
          status: 'proposed',
          partNumber: (b.partNumber as string) || 'PCB-2024-A',
          warehouseId: (b.warehouseId as string) || 'WH-QC',
          location: (b.location as string) || 'BULK',
          quantity: Number(b.quantity) || 0,
          reason: (b.reason as string) || '',
          proposedBy: 'Master',
          createdAt: new Date().toISOString(),
        };
        dispositions.push(d);
        return send(d, 201);
      }
      const m = path.match(/^\/quality\/dispositions\/(\d+)\/(approve|execute)$/);
      if (m && method === 'PATCH') {
        const d = dispositions.find((x) => x.id === Number(m[1]));
        if (d) d.status = m[2] === 'approve' ? 'approved' : 'executed';
        return send(d ?? {});
      }
      return send(method === 'GET' ? [] : { ok: true });
    });

    await page.goto('/dashboard/quality/holds');
    await expect(page.getByRole('heading', { name: /Holds de inventario/ })).toBeVisible();
    await expect(page.getByText('PCB-2024-A')).toBeVisible();

    // Propose a disposition straight from the hold.
    await page.getByRole('button', { name: 'Proponer disposición' }).click();
    const dialog = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: /Proponer disposición/ }) })
      .filter({ has: page.getByRole('button', { name: 'Cancelar' }) })
      .last();
    await dialog.getByLabel(/Almacén/).fill('WH-QC');
    await dialog.getByLabel(/Cantidad/).fill('5');
    await dialog.getByLabel(/Razón/).fill('Daño irreparable');
    await dialog.getByRole('button', { name: 'Proponer' }).click();

    // Proposed ⇒ Aprobar appears → approve → Ejecutar appears → execute.
    const approve = page.getByRole('button', { name: 'Aprobar' });
    await expect(approve).toBeVisible();
    await approve.click();

    const execute = page.getByRole('button', { name: 'Ejecutar' });
    await expect(execute).toBeVisible();
    await execute.click();

    // Executed ⇒ terminal: badge reads Ejecutada, no actions remain. (exact match
    // avoids the transient toast "Disposición ejecutada — …".)
    await expect(page.getByText('Ejecutada', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprobar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ejecutar' })).toHaveCount(0);
  });
});
