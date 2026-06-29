import { test, expect, type Page } from '@playwright/test';
import { installMockBackend } from '../fixtures/mock-backend';
import { loginAsMaster } from '../fixtures/session';
import { API_ORIGIN } from '../fixtures/constants';

/**
 * Golden path · FLUJO END-TO-END — un solo hilo que CONECTA las pantallas.
 *
 * Los specs 01–08 prueban cada pantalla por separado (cada uno con su backend
 * fresco). Este spec recorre el camino real de UNA pieza de trabajo a través de
 * la planta, en una sola sesión Master y un solo backend en memoria (el estado
 * persiste entre páginas), comprobando en CADA paso que el dato del paso anterior
 * REAPARECE en el siguiente — no solo que cada pantalla carga:
 *
 *   1. Login Master            → el hub saluda a Master y muestra las áreas del flujo
 *   2. Crear modelo (NPI)      → MDL-FLOW-001 nace en Borrador
 *   3. BOM                     → 2 partes (una con stock, una sin stock)
 *   4. Activar BOM + modelo    → el BOM queda "listo" y el modelo "Activo"
 *   5. Publicar plan (muro)    → el MODELO recién creado sale en el selector del planeador
 *   6. Ver WO en el muro       → la WO lleva el modelo; su Clear-to-Build ya marca el
 *                                faltante de la parte sin stock (BOM → muro)
 *   7. Surtir como almacén     → el surtido se explota del BOM de la WO; se monta la
 *                                parte con stock y se marca faltante la otra
 *   8. Ver faltante            → KPI de faltantes + llamado de reposición de la MISMA
 *                                parte (almacén cierra el lazo del faltante del muro)
 *
 * Determinista: backend fresco por test ⇒ IDs fijos. Modelo MDL-FLOW-001, parte
 * CMP-FLOW-A (con stock → se monta) y CMP-FLOW-B (sin stock → faltante).
 */

const MODEL = 'MDL-FLOW-001';
const PART_OK = 'CMP-FLOW-A'; // hay stock en almacén → se monta a línea
const PART_SHORT = 'CMP-FLOW-B'; // sin stock → faltante / shortage

test.describe('Golden path · flujo end-to-end (conecta el camino real)', () => {
  test('login → modelo → BOM → activar → publicar → muro → surtir → faltante', async ({
    page,
    context,
  }) => {
    // Un solo test recorre ~6 rutas que `next dev` compila on-demand la primera vez.
    test.slow();

    await installMockBackend(context); // muro vacío; arrancamos de cero
    await loginAsMaster(context);

    // El almacén tiene stock de CMP-FLOW-A pero NADA de CMP-FLOW-B. Esto alimenta
    // el semáforo Clear-to-Build del muro (que explota el BOM activo contra
    // /inventory/positions), de modo que el faltante de CMP-FLOW-B sea real y no
    // un valor inventado. Se registra DESPUÉS del mock base, así que gana.
    await context.route(`${API_ORIGIN}/inventory/positions`, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { partNumber: PART_OK, onHand: 1000, allocated: 0, holdStatus: 'available' },
          { partNumber: PART_SHORT, onHand: 0, allocated: 0, holdStatus: 'available' },
        ]),
      }),
    );

    // ── 1) LOGIN MASTER → hub + navegación rail-primario con las áreas del flujo ─
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Hola, Master\./ })).toBeVisible();
    // El Master ve las áreas que vamos a recorrer en el Command rail (la única
    // fuente de navegación; el home ya no duplica la rejilla de módulos).
    const rail = page.locator('aside[aria-label="Navegación principal por dominios"]');
    await expect(rail.getByRole('link', { name: 'Product Master', exact: true })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Surtido a línea', exact: true })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Operador MES', exact: true })).toBeVisible();

    // 1→2: entramos a Modelos DESDE el rail (no por URL: probamos que la navegación conecta).
    await rail.getByRole('link', { name: 'Product Master', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/models$/);
    await expect(page.getByRole('heading', { name: /Modelos · Product Master/ })).toBeVisible();

    // ── 2) CREAR MODELO ──────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Nuevo modelo' }).click();
    await page.getByPlaceholder(/Controlador EV/).fill('AXOS Flow — Controlador E2E');
    await page.getByPlaceholder(/MDL/).fill(MODEL);
    await page.getByRole('button', { name: 'Crear modelo' }).click();

    // CONECTA: aterrizamos en el detalle del modelo recién creado, en Borrador,
    // con el número que tecleamos.
    await expect(page).toHaveURL(/\/dashboard\/models\/mdl-e2e-/);
    await expect(page.getByTestId('model-status-pill')).toHaveText(/Borrador/);
    await expect(page.getByText(MODEL).first()).toBeVisible();

    // ── 3) BOM: 2 partes (una con stock, una sin stock) ──────────────────────
    await page.getByTestId('bom-create-btn').click();
    await addBomPart(page, PART_OK, '2');
    await addBomPart(page, PART_SHORT, '1');
    // CONECTA: ambas partes del BOM quedan como renglones del BOM.
    await expect(page.getByTestId('bom-component-row').filter({ hasText: PART_OK })).toBeVisible();
    await expect(page.getByTestId('bom-component-row').filter({ hasText: PART_SHORT })).toBeVisible();

    // ── 4) ACTIVAR BOM + MODELO ──────────────────────────────────────────────
    await page.getByRole('button', { name: 'Aprobar BOM' }).click();
    await page.getByRole('button', { name: 'Activar BOM' }).click();
    await expect(page.getByText(/BOM activo/)).toBeVisible(); // "BOM activo — listo para planeación"
    await page.getByTestId('model-activate-btn').click();
    await expect(page.getByTestId('model-status-pill')).toHaveText(/Activo/);

    // ── 5) PUBLICAR PLAN (muro de WOs) ───────────────────────────────────────
    await page.goto('/dashboard/production-plan');
    await page.getByTestId('wo-publish-open').click();
    // CONECTA: el modelo creado en NPI aparece en el selector del planeador.
    const modelSelect = page.getByTestId('wo-model-select');
    await expect(modelSelect.locator(`option[value="${MODEL}"]`)).toHaveCount(1);
    await modelSelect.selectOption(MODEL);
    await page.getByTestId('wo-publish-submit').click();

    // ── 6) VER WO EN EL MURO ─────────────────────────────────────────────────
    // CONECTA: la WO publicada lleva el modelo MDL-FLOW-001.
    const card = page.locator(`[data-testid="wo-card"][data-model="${MODEL}"]`);
    await expect(card).toBeVisible();
    const folio = await card.getAttribute('data-folio');
    expect(folio, 'la WO publicada debe traer folio').toBeTruthy();

    // CONECTA (BOM → muro): el Clear-to-Build ya marca el faltante de la parte sin
    // stock. Con una de dos partes corta, el semáforo es "caution" (Con reservas).
    const ctb = card.getByTestId('wo-ctb');
    await expect(ctb).toHaveAttribute('data-ctb-status', 'caution');
    await ctb.click(); // desplegar el detalle de readiness
    await expect(card.getByText('Faltantes para terminar')).toBeVisible();
    await expect(card.getByText(PART_SHORT)).toBeVisible();
    await expect(card.getByText(/falta/).first()).toBeVisible();

    // ── 7) SURTIR COMO ALMACÉN ───────────────────────────────────────────────
    await page.goto('/dashboard/material-staging');
    await expect(page.getByRole('heading', { name: /Surtido y e-kanban/ })).toBeVisible();
    // CONECTA (muro → almacén): la WO publicada es la WO activa en surtido.
    await expect(page.getByRole('button', { name: new RegExp(folio!) })).toBeVisible();
    // Generar el kit desde el ruteo/BOM de la WO.
    await page.getByRole('button', { name: 'Generar surtido' }).click();
    // CONECTA (BOM → surtido): las líneas de surtido son EXACTAMENTE las partes del BOM.
    const lineOk = stagingRow(page, PART_OK);
    const lineShort = stagingRow(page, PART_SHORT);
    await expect(lineOk).toBeVisible();
    await expect(lineShort).toBeVisible();
    // Montar la parte con stock → "Montado".
    await lineOk.getByRole('button', { name: 'Montar' }).click();
    await expect(lineOk.getByText('Montado')).toBeVisible();
    // Marcar faltante la parte sin stock.
    await lineShort.getByRole('button', { name: 'Faltante' }).click();

    // ── 8) VER FALTANTE ──────────────────────────────────────────────────────
    // KPI de faltantes = 1 (la etiqueta "Faltantes" es plural ⇒ única en la página).
    await expect(kpiTile(page, 'Faltantes')).toContainText('1');
    // CONECTA: el faltante levantó un llamado de reposición de la MISMA parte, así
    // que CMP-FLOW-B aparece ahora dos veces (la línea de surtido + el llamado).
    await expect(page.getByText(PART_SHORT)).toHaveCount(2);
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

/** Agrega una parte al BOM (maestro de materiales idempotente + componente). */
async function addBomPart(page: Page, part: string, qty: string): Promise<void> {
  await page.getByTestId('bom-part-input').fill(part);
  await page.getByTestId('bom-qty-input').fill(qty);
  await page.getByTestId('bom-add-btn').click();
  await expect(page.getByTestId('bom-component-row').filter({ hasText: part })).toBeVisible();
}

/**
 * Renglón de surtido de una parte: el div que contiene tanto el texto de la parte
 * como sus botones (Montar/Faltante). `.last()` toma el más interno (la fila real,
 * no los contenedores que la envuelven).
 */
function stagingRow(page: Page, part: string) {
  return page
    .locator('div')
    .filter({ hasText: part })
    .filter({ has: page.getByRole('button', { name: 'Montar' }) })
    .last();
}

/** Tarjeta KPI localizada por su etiqueta (única); devuelve la tarjeta completa. */
function kpiTile(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('xpath=..');
}
