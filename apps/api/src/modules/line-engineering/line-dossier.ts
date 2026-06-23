/**
 * Pure, side-effect-free CSV serialization for the layout dossier (Fase 39).
 *
 * The dossier endpoint hands the planner the whole computed picture of a layout
 * — readiness, balance, manning, cost — plus the per-station table. This turns
 * that station table into a spreadsheet-ready CSV (RFC-4180 quoting) so it can
 * be opened in Excel or pasted into a report, closing the loop on the analytics
 * suite by making its output portable.
 *
 * Kept pure so the quoting/escaping can be unit-tested without a DB or HTTP.
 */

export interface DossierStationRow {
  station: string;
  line: string;
  sequence: number;
  cycleTimeSec: number;
  hasNp: boolean;
  hasUseFactor: boolean;
  hasVisualAid: boolean;
  complete: boolean;
  placed: boolean;
}

const HEADERS = [
  'Estación',
  'Línea',
  'Secuencia',
  'Ciclo (s)',
  'NP',
  'Factor de uso',
  'Ayuda visual',
  'Completa',
  'Colocada',
];

/** Quote a CSV field per RFC 4180 when it contains a comma, quote or newline. */
function csvField(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const yn = (b: boolean): string => (b ? 'Sí' : 'No');

export function dossierStationsToCsv(rows: DossierStationRow[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows ?? []) {
    lines.push(
      [
        csvField(r.station),
        csvField(r.line),
        csvField(r.sequence),
        csvField(r.cycleTimeSec),
        yn(r.hasNp),
        yn(r.hasUseFactor),
        yn(r.hasVisualAid),
        yn(r.complete),
        yn(r.placed),
      ].join(','),
    );
  }
  return lines.join('\n');
}
