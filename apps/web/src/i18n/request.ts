import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "./locale";
import { messagesByLocale } from "../../messages";

/**
 * Configuración por petición de next-intl. Resuelve el idioma desde la cookie
 * (server-side, SSR-safe) y entrega los catálogos del idioma correspondiente.
 *
 * - `onError`: silenciamos los MISSING_MESSAGE durante la migración progresiva.
 *   Mientras quedan pantallas sin internacionalizar, una clave inexistente no
 *   debe ensuciar la consola ni romper el render. (Cumple "cero console.* nuevos".)
 * - `getMessageFallback`: si falta una clave, mostramos su último segmento en
 *   vez del path completo, para que nunca se vea `namespace.algo.clave` en la UI.
 * - `timeZone`: fijo en UTC para evitar mismatches de hidratación SSR/cliente.
 */
export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  return {
    locale,
    messages: messagesByLocale[locale],
    timeZone: "UTC",
    onError() {
      // Intencionalmente vacío: no registramos MISSING_MESSAGE en consola.
    },
    getMessageFallback({ key }) {
      const segments = key.split(".");
      return segments[segments.length - 1] ?? key;
    },
  };
});
