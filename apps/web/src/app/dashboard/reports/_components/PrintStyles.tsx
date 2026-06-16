"use client";

/**
 * Aislamiento de impresión (print-to-PDF del navegador) — local al carril de
 * Reportes. No existe backend de generación de PDF; la vía honesta es
 * "Imprimir / Guardar como PDF" del navegador sobre una hoja optimizada.
 *
 * Técnica (igual precedente que el módulo Office con Paged.js): en `@media print`
 * se oculta TODO (`visibility:hidden`) salvo `.axos-doc`, que se ancla arriba a la
 * izquierda y se fuerza a blanco/negro con `print-color-adjust: exact` para que el
 * documento salga limpio aunque el SO esté en modo oscuro. El estilo vive aquí
 * (no en un CSS global compartido) para respetar el límite del carril; se monta
 * sólo en páginas de reporte y se desmonta al salir.
 */
const PRINT_CSS = `
@media print {
  /* Oculta toda la chrome del dashboard (aurora, top bar, dock, controles). */
  body * { visibility: hidden !important; }
  .axos-doc, .axos-doc * { visibility: visible !important; }
  .axos-doc {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .axos-doc .axos-paper {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
  }
  /* Elementos sólo-pantalla (botones, ayudas) no se imprimen. */
  .axos-no-print { display: none !important; }
  /* Evita cortes feos dentro de bloques/tablas. */
  .axos-avoid-break { break-inside: avoid; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  @page { margin: 14mm; }
}
`;

export function PrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />;
}
