import { test, expect } from '@playwright/test';

/**
 * Tests mínimos de los primitivos de UI compartidos (Modal, Collapsible,
 * DropdownMenu) contra el banco de pruebas `/dev/ui-primitives`.
 *
 * Verifican exactamente las causas raíz que arregla el barrido visual:
 *  - el modal SE PUEDE CERRAR (Escape, click-fuera, botón de cerrar) y su botón
 *    de cerrar está dentro del viewport y tiene tamaño no nulo;
 *  - el colapsable revela/oculta su contenido con `aria-expanded` correcto;
 *  - el dropdown se renderiza por portal, con fondo OPACO y dentro del viewport.
 */

const ROUTE = '/dev/ui-primitives';

test.describe('Primitivos de UI compartidos', () => {
  test('Modal: se abre y se cierra por Escape, backdrop y botón', async ({ page }) => {
    await page.goto(ROUTE);

    const open = page.getByTestId('demo-modal-open');
    const panel = page.getByTestId('demo-modal');
    const closeBtn = page.getByTestId('demo-modal-close');

    // Abre y verifica que el botón de cerrar es visible, con tamaño y dentro del viewport.
    await open.click();
    await expect(panel).toBeVisible();
    await expect(closeBtn).toBeVisible();
    const box = await closeBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    const vp = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);

    // Escape cierra.
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    // Click en el backdrop cierra.
    await open.click();
    await expect(panel).toBeVisible();
    await page.getByTestId('demo-modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(panel).toBeHidden();

    // Botón de cerrar cierra.
    await open.click();
    await expect(panel).toBeVisible();
    await closeBtn.click();
    await expect(panel).toBeHidden();
  });

  test('Collapsible: revela y oculta con aria-expanded correcto', async ({ page }) => {
    await page.goto(ROUTE);

    const trigger = page.getByTestId('demo-collapsible-trigger');
    const body = page.getByTestId('demo-collapsible-body');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(body).toBeHidden();

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(body).toBeVisible();

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(body).toBeHidden();
  });

  test('DropdownMenu: portal, fondo opaco y cierre al elegir ítem', async ({ page }) => {
    await page.goto(ROUTE);

    const trigger = page.getByTestId('demo-dropdown-trigger');
    const menu = page.getByTestId('demo-dropdown');

    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'menu');

    // Renderizado por portal: el menú es hijo directo de <body>, no del trigger.
    const isPortaled = await menu.evaluate((el) => el.parentElement === document.body);
    expect(isPortaled).toBe(true);

    // Fondo OPACO: el color de fondo computado no es transparente (alfa = 1).
    const bg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
    expect(bg).not.toMatch(/rgba\([^)]+,\s*0?\.\d+\)$/); // descarta alfa < 1

    // Dentro del viewport.
    const box = await menu.boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);

    // Elegir un ítem cierra el menú.
    await page.getByTestId('demo-dropdown-item').click();
    await expect(menu).toBeHidden();
  });
});
