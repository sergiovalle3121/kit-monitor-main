import { test, expect } from '@playwright/test';

/**
 * Fase 4 · Generación de mazos EMS-native.
 *
 * El arné `/dev/deck-gen` (solo dev) construye los decks de revisión de línea y
 * de calidad con datos de muestra y verifica que tengan las diapositivas
 * esperadas, gráficos/tablas nativos y que carguen en Fabric. Ruta pública (el
 * middleware solo protege /dashboard), no requiere sesión.
 */
test.describe('EMS · generación de mazos (line review + calidad)', () => {
  test('arma decks válidos con tabla/gráfico nativos y cargables en Fabric', async ({ page }) => {
    await page.goto('/dev/deck-gen');
    const status = page.getByTestId('dg-status');
    await expect(status).toHaveText(/PASS|FAIL/, { timeout: 45000 });
    const detail = (await page.getByTestId('dg-result').textContent()) || '';
    expect(status, `deck-gen detail: ${detail}`).toHaveText('PASS');
  });
});
