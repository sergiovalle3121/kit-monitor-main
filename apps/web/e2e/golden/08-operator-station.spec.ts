import { test, expect } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';
import { API_ORIGIN } from '../fixtures/constants';

/**
 * Operador · abrir estación (MES board).
 *
 * Distinct from the operator-terminal page covered by 04: this is the MES
 * shop-floor board at /dashboard/operador (/mes/executions + /mes/board). The
 * operator opens a work order — by picking one of the live orders or by scanning
 * its WO — and lands on the live station board (rail, current step, action bar).
 * The MES realtime socket has no server here and is aborted to avoid a noisy
 * reconnect loop.
 */

function board() {
  const step = (seq: number, name: string, status: string) => ({
    id: seq,
    stepId: seq,
    sequence: seq,
    name,
    stationType: 'assembly',
    status,
    unitsTarget: 10,
    unitsCompleted: status === 'in_process' ? 2 : 0,
    scrapQty: 0,
    segregatedQty: 0,
    upstreamAvailable: 10,
    maxConfirmable: 8,
    starved: false,
    currentOperator: null,
    blockReason: null,
  });
  const steps = [step(1, 'Preparación', 'in_process'), step(2, 'Ensamble', 'pending'), step(3, 'Prueba funcional', 'pending')];
  return {
    execution: {
      id: 501,
      workOrder: '00042',
      model: 'AX-1000',
      revision: 'A',
      line: 3,
      buildingId: null,
      quantity: 10,
      status: 'in_process',
      startedAt: new Date().toISOString(),
      completedAt: null,
    },
    steps,
    currentStep: steps[0],
    currentStepDetail: {
      id: 1,
      stepId: 1,
      name: 'Preparación',
      instructions: 'Coloca el PCB en el nido y verifica la orientación.',
      visualAid: null,
      materials: [],
      openIncidents: [],
    },
    andons: [],
    openDowntime: [],
    assignments: [],
    materialRequests: [],
    downtimeSummarySec: 0,
  };
}

const execItem = {
  id: 501,
  workOrder: '00042',
  model: 'AX-1000',
  revision: 'A',
  line: 3,
  quantity: 10,
  status: 'open',
  steps: 3,
  progress: 0.2,
  blocked: false,
};

test.describe('Operador · abrir estación (MES)', () => {
  test('abre la estación eligiendo una orden de la línea', async ({ page, context }) => {
    await installMockBackend(context);
    await loginAsMaster(context);
    await context.route(`${API_ORIGIN}/socket.io/**`, (r) => r.abort());
    await context.route(`${API_ORIGIN}/mes/**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      const send = (d: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
      if (path === '/mes/executions') return send([execItem]);
      if (path === '/mes/board') return send(board());
      return send([]);
    });

    await page.goto('/dashboard/operador');
    await expect(page.getByRole('heading', { name: 'Monta tu orden' })).toBeVisible();
    await expect(page.getByText('Órdenes en la línea')).toBeVisible();
    await expect(page.getByText('WO 00042')).toBeVisible();

    // Pick the order → the live station board mounts.
    await page.getByRole('button', { name: /AX-1000/ }).click();
    await expect(page.getByText(/WO 00042/)).toBeVisible(); // board banner
    await expect(page.getByText('Estación 1')).toBeVisible(); // station rail
    await expect(page.getByRole('button', { name: /Confirmar avance/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Órdenes' })).toBeVisible();
  });

  test('abre la estación escaneando la WO', async ({ page, context }) => {
    await installMockBackend(context);
    await loginAsMaster(context);
    await context.route(`${API_ORIGIN}/socket.io/**`, (r) => r.abort());
    await context.route(`${API_ORIGIN}/mes/**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      const send = (d: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
      if (path === '/mes/executions') return send([]); // nothing pre-staged ⇒ scan path
      if (path === '/mes/board') return send(board());
      return send([]);
    });

    await page.goto('/dashboard/operador');
    await expect(page.getByText('Sin órdenes montadas')).toBeVisible();

    await page.getByPlaceholder(/Escanea/).fill('00042');
    await page.getByRole('button', { name: 'Montar' }).click();

    await expect(page.getByText(/WO 00042/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirmar avance/ })).toBeVisible();
  });
});
