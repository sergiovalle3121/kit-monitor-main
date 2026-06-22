import { test, expect } from '@playwright/test';

/**
 * Fase 2 · Fidelidad del round-trip .pptx.
 *
 * El arné `/dev/pptx-roundtrip` (solo dev) arma un mazo con un objeto de cada
 * tipo soportado, lo exporta a .pptx en memoria con PptxGenJS y lo vuelve a
 * importar con el parser; verifica que sobrevivan texto (con viñetas), formas,
 * imagen, tabla y gráfico nativos, el fondo, la relación de aspecto y las notas.
 * Es una ruta pública (el middleware solo protege /dashboard), así que no
 * requiere sesión.
 */
test.describe('Office · Slides .pptx round-trip (fidelidad)', () => {
  test('export → import conserva texto, formas, imagen, tabla, gráfico, fondo y notas', async ({ page }) => {
    await page.goto('/dev/pptx-roundtrip');
    const status = page.getByTestId('rt-status');
    await expect(status).toHaveText(/PASS|FAIL/, { timeout: 45000 });
    const detail = (await page.getByTestId('rt-result').textContent()) || '';
    expect(status, `round-trip detail: ${detail}`).toHaveText('PASS');
  });
});
