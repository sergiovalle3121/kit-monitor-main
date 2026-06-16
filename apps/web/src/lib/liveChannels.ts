/**
 * Live floor channels — shared metadata + types for the real-time spine.
 *
 * Pure module (no React / no socket): consumed by the `useLiveEvents` hook and
 * the "Piso en Vivo" board, and ready for other pages to adopt later. Mirrors
 * the backend contract in `apps/api/src/modules/live/live-channel.ts`.
 */

export type LiveChannel =
  | 'andon'
  | 'production'
  | 'quality'
  | 'oee'
  | 'materials';

export const LIVE_CHANNELS: LiveChannel[] = [
  'andon',
  'production',
  'quality',
  'oee',
  'materials',
];

/** Light transport DTO broadcast by the gateway (and seeded by /live/snapshot). */
export interface LiveEvent {
  id: string;
  channel: LiveChannel;
  domain: string;
  action: string;
  referenceType: string | null;
  referenceId: string | null;
  line: string | null;
  workOrder: string | null;
  model: string | null;
  plant: string | null;
  actorName: string | null;
  tenantId: string | null;
  timestamp: string;
}

export interface LiveSnapshot {
  channels: LiveChannel[];
  events: LiveEvent[];
  counts: Record<LiveChannel, number>;
  generatedAt: string;
}

export const CHANNEL_META: Record<
  LiveChannel,
  { label: string; color: string }
> = {
  andon: { label: 'Andon', color: '#ef4444' },
  production: { label: 'Producción', color: '#06b6d4' },
  quality: { label: 'Calidad', color: '#a855f7' },
  oee: { label: 'OEE / Paros', color: '#f59e0b' },
  materials: { label: 'Materiales', color: '#10b981' },
};

/** Known ledger actions → floor-friendly Spanish phrasing for the ticker. */
const ACTION_LABELS: Record<string, string> = {
  SF_ANDON_MATERIAL: 'Andon de material',
  SF_ANDON_QUALITY: 'Andon de calidad',
  SF_ANDON_MACHINE: 'Andon de máquina',
  SF_ANDON_HELP: 'Andon de ayuda',
  SF_ANDON_SAFETY: 'Andon de seguridad',
  SF_PRODUCTION_CONFIRMED: 'Avance confirmado',
  SF_WO_PUBLISHED: 'WO publicada',
  SF_WO_RESEQUENCED: 'WO resecuenciada',
  SF_WO_TRANSITIONED: 'WO cambió de estado',
  SF_WO_OPERATORS_AUTHORIZED: 'Operadores autorizados',
  SF_DOWNTIME_OPENED: 'Paro abierto',
  SF_DOWNTIME_CLOSED: 'Paro cerrado',
  SF_QUALITY_HOLD_CREATED: 'Hold de calidad creado',
  SF_QUALITY_HOLD_TO_MRB: 'Hold enviado a MRB',
  SF_QUALITY_HOLD_DISPOSITIONED: 'Hold dispuesto',
  SF_QUALITY_REWORK_STARTED: 'Retrabajo iniciado',
  SF_QUALITY_REINSPECT: 'Re-inspección',
  SF_QUALITY_HOLD_CLOSED: 'Hold cerrado',
  SF_STAGING_GENERATED: 'Surtido generado',
  SF_STAGING_CONFIRMED: 'Surtido confirmado',
  SF_STAGING_SHORTAGE: 'Faltante en surtido',
  SF_REPLENISH_RAISED: 'Reposición solicitada',
  SF_REPLENISH_TRANSITIONED: 'Reposición avanzó',
};

/** Human label for a raw ledger action (prettified fallback for unknowns). */
export function actionLabel(action: string | null | undefined): string {
  if (!action) return 'Evento';
  return (
    ACTION_LABELS[action] ??
    action
      .replace(/^SF_/, '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

/** Compact relative time ("ahora", "hace 3 min", "hace 2 h"). */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 5) return 'ahora';
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
