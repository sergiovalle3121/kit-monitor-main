import { test, expect } from '@playwright/test';

/**
 * Fase 5 · Fidelidad de import de .pptx FORÁNEOS.
 *
 * El arné `/dev/pptx-foreign` (solo dev) arma a mano un .pptx con
 * construcciones que nuestro exportador no emite — geometría de marcador
 * heredada del layout, schemeClr contra un tema real, lumMod y clrMap — y
 * verifica que el importer resuelva tema, herencia de geometría y modificadores
 * de color. Ruta pública (el middleware solo protege /dashboard).
 */
test.describe('Office · import .pptx foráneo (fidelidad de tema/marcadores)', () => {
  test('resuelve tema, hereda geometría de marcador y aplica modificadores de color', async ({ page }) => {
    await page.goto('/dev/pptx-foreign');
    const status = page.getByTestId('fi-status');
    await expect(status).toHaveText(/PASS|FAIL/, { timeout: 45000 });
    const detail = (await page.getByTestId('fi-result').textContent()) || '';
    expect(status, `foreign-import detail: ${detail}`).toHaveText('PASS');
  });
});
