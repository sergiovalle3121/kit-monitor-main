"use client";

/**
 * Mapa de nombres legibles para los modelos crípticos del seed demo (AX-DRIVE-100,
 * AX-MOTOR-500, …). PURAMENTE de presentación: NO altera el seed ni la base de
 * datos. Si un modelo trae su propio `name` en el dato, úsalo; este mapa es el
 * respaldo para pantallas donde sólo se muestra el código.
 *
 * Fuente de los nombres: apps/api/src/seed/seed-constants.ts (campo `name`),
 * traducidos a EN para el idioma por defecto.
 */

import { useLocale } from "next-intl";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

type BilingualName = { en: string; es: string };

export const MODEL_DISPLAY_NAMES: Record<string, BilingualName> = {
  "AX-DRIVE-100": { en: "Traction Controller Card", es: "Tarjeta Controladora de Tracción" },
  "AX-POWER-200": { en: "48V Power Module", es: "Módulo de Potencia 48V" },
  "AX-SENSE-300": { en: "Environmental Sensor Board", es: "Placa de Sensores Ambientales" },
  "AX-COMM-400": { en: "Industrial Communication Module", es: "Módulo de Comunicación Industrial" },
  "AX-MOTOR-500": { en: "Three-Phase Motor Controller", es: "Controlador de Motor Trifásico" },
  "AX-GATE-600": { en: "Industrial Gateway", es: "Gateway Industrial" },
  "AX-METER-700": { en: "Three-Phase Energy Meter", es: "Medidor de Energía Trifásico" },
  "AX-NODE-800": { en: "IoT Sensor Node", es: "Nodo de Sensores IoT" },
};

/** Devuelve el nombre legible del modelo, o `null` si no hay mapeo. */
export function modelDisplayName(
  code: string | null | undefined,
  locale: Locale | string = defaultLocale,
): string | null {
  if (!code) return null;
  const entry = MODEL_DISPLAY_NAMES[code.toUpperCase()];
  if (!entry) return null;
  const l = isLocale(locale) ? locale : defaultLocale;
  return entry[l];
}

/** Hook: devuelve un resolvedor de nombre legible ligado al idioma activo. */
export function useModelDisplayName(): (code: string | null | undefined) => string | null {
  const locale = useLocale();
  return (code) => modelDisplayName(code, locale);
}
