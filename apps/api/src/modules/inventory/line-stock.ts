/**
 * Convención compartida del "tanque" de material a pie de línea.
 *
 * El surtido DEPOSITA material en el almacén virtual `LINE-<línea>` y la
 * ejecución (MES /operador) lo CONSUME de ahí. Para que el depósito y el
 * consumo toquen exactamente la misma `InventoryPosition`, ambos lados deben
 * coincidir en la llave de la posición: (parte, almacén, location, programId).
 *
 * - Almacén: `LINE-<línea>` — la misma convención que ya usan production-runtime
 *   y mes-execution. NO se inventa otra.
 * - Location: una constante a nivel de LÍNEA (no por estación). Antes el consumo
 *   leía con `fromLocation: step.name`, fragmentando el tanque por estación, de
 *   modo que un surtido a la línea nunca podía servir a varias estaciones. Como
 *   el almacén `LINE-<n>` no tenía posiciones (estaba vacío), esa location por
 *   estación jamás funcionó: unificarla a nivel de línea sólo mejora.
 */

/** Location a nivel de línea para el stock de la línea (el "tanque"). */
export const LINE_STOCK_LOCATION = 'LINE';

/**
 * Almacén virtual de línea para una línea dada. Devuelve `null` cuando no hay
 * línea: en ese caso NO hay origen/destino válido y el llamador debe registrar
 * el caso de forma visible en vez de mover a un `LINE-0`/`LINE-null` inexistente.
 */
export function lineStockWarehouse(
  line: number | string | null | undefined,
): string | null {
  if (line === null || line === undefined || line === '') return null;
  return `LINE-${line}`;
}
