/** Formateadores puros y helpers del visor de genealogía (sin React, testables). */

/** Fecha/hora legible (es-MX). Devuelve '—' si falta o es inválida. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** "hace 3 h" / "hace 2 d" — vacío si falta o es inválida. */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'hace instantes';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `hace ${mo} mes${mo > 1 ? 'es' : ''}`;
  return `hace ${Math.floor(mo / 12)} a`;
}

/** Cantidad sin ceros de cola (5, 2.5, 0.75). */
export function fmtQty(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

export interface SourceMeta {
  label: string;
  color: string;
}

/** Etiqueta + color por origen del eslabón (de dónde salió la genealogía). */
export function sourceMeta(source: string | null | undefined): SourceMeta {
  switch (source) {
    case 'SF_CONSUMPTION':
      return { label: 'Ledger de piso', color: '#3b82f6' };
    case 'OPERATOR_TERMINAL':
      return { label: 'Terminal', color: '#22b8cf' };
    case 'MANUAL':
      return { label: 'Captura manual', color: '#7c3aed' };
    default:
      return { label: source || '—', color: '#6b7280' };
  }
}

/** Copia texto al portapapeles. Devuelve true si lo logró. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* sin portapapeles disponible */
  }
  return false;
}
