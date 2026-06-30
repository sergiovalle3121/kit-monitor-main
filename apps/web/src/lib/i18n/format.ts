"use client";

/**
 * Helpers de formato sensibles al idioma (fechas, números, moneda, relativo).
 *
 * Centralizan el uso de `Intl.*` con el tag BCP-47 correcto según el locale
 * activo (en-US / es-MX). Úsalos en vez de `toLocaleDateString()` suelto para
 * que un cambio EN↔ES re-formatee todo de forma consistente.
 */

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { localeIntlTag, type Locale, defaultLocale, isLocale } from "@/i18n/config";

function tagFor(locale: string): string {
  return isLocale(locale) ? localeIntlTag[locale] : localeIntlTag[defaultLocale];
}

function toDate(value: Date | string | number): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(
  value: Date | string | number,
  locale: Locale | string = defaultLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat(tagFor(locale), options).format(d);
}

export function formatDateTime(
  value: Date | string | number,
  locale: Locale | string = defaultLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return formatDate(value, locale, options);
}

export function formatNumber(
  value: number,
  locale: Locale | string = defaultLocale,
  options: Intl.NumberFormatOptions = {},
): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return new Intl.NumberFormat(tagFor(locale), options).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale | string = defaultLocale,
  currency = "USD",
): string {
  return formatNumber(value, locale, { style: "currency", currency });
}

export function formatPercent(
  value: number,
  locale: Locale | string = defaultLocale,
  fractionDigits = 0,
): string {
  return formatNumber(value, locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Formato relativo ("hace 3 min" / "3 min ago") usando Intl.RelativeTimeFormat.
 * `from`/`to` en milisegundos epoch; si se omite `to` usa el dato como diferencia.
 */
export function formatRelativeTime(
  fromMs: number,
  toMs: number,
  locale: Locale | string = defaultLocale,
): string {
  const diffSec = Math.round((fromMs - toMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat(tagFor(locale), { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

/**
 * Hook que devuelve formateadores ya enlazados al idioma activo. Úsalo en
 * componentes cliente: `const fmt = useLocaleFormat(); fmt.date(value)`.
 */
export function useLocaleFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      date: (v: Date | string | number, o?: Intl.DateTimeFormatOptions) =>
        formatDate(v, locale, o),
      dateTime: (v: Date | string | number, o?: Intl.DateTimeFormatOptions) =>
        formatDateTime(v, locale, o),
      number: (v: number, o?: Intl.NumberFormatOptions) => formatNumber(v, locale, o),
      currency: (v: number, currency?: string) => formatCurrency(v, locale, currency),
      percent: (v: number, digits?: number) => formatPercent(v, locale, digits),
      relativeTime: (fromMs: number, toMs: number) =>
        formatRelativeTime(fromMs, toMs, locale),
    }),
    [locale],
  );
}
