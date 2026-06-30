/**
 * Punto único de acceso a los catálogos de mensajes por idioma. `request.ts`
 * de next-intl selecciona aquí el catálogo según la cookie de idioma.
 */
import type { Locale } from "../src/i18n/config";
import en from "./en";
import es from "./es";

/** El catálogo en inglés define la forma canónica de las claves. */
export type Messages = typeof en;

export const messagesByLocale: Record<Locale, Messages> = {
  en,
  es: es as Messages,
};
