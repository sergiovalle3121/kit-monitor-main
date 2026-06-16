// Pure vocabularies + helpers for handling units (side-effect free; shared by the
// entity, service and specs).
import type { HandlingUnitContent } from './entities/handling-unit.entity';

export type HandlingUnitType = 'PALLET' | 'CARTON' | 'BOX';
export const HANDLING_UNIT_TYPES: HandlingUnitType[] = ['PALLET', 'CARTON', 'BOX'];

export type HandlingUnitStatus = 'OPEN' | 'PACKED' | 'LOADED';
export const HANDLING_UNIT_STATUSES: HandlingUnitStatus[] = ['OPEN', 'PACKED', 'LOADED'];

/** Short, label-friendly summary of a handling unit's contents. */
export function summarizeContents(contents?: HandlingUnitContent[] | null): string {
  if (!contents || contents.length === 0) return '';
  return contents
    .map((c) => `${c.partNumber} x${c.quantity}`)
    .join(' · ');
}

/** Total pieces across all content lines. */
export function totalPieces(contents?: HandlingUnitContent[] | null): number {
  return (contents ?? []).reduce((acc, c) => acc + (Number(c.quantity) || 0), 0);
}

/** Coerce raw input into clean content lines (drop blanks, normalize numbers). */
export function sanitizeContents(raw: unknown): HandlingUnitContent[] {
  if (!Array.isArray(raw)) return [];
  const out: HandlingUnitContent[] = [];
  for (const r of raw) {
    const line = r as Record<string, unknown>;
    const partNumber = String(line?.partNumber ?? '').trim();
    const quantity = Number(line?.quantity ?? 0);
    if (!partNumber || !(quantity > 0)) continue;
    const serials = Array.isArray(line?.serials)
      ? (line.serials as unknown[]).map((s) => String(s).trim()).filter(Boolean)
      : undefined;
    out.push({ partNumber, quantity, ...(serials && serials.length ? { serials } : {}) });
  }
  return out;
}
