/**
 * Cálculo de AGING y SLA de un pull (pedido de material), aislado en funciones
 * puras para que el semáforo sea testeable y compartible entre el monitor en vivo
 * y la analítica de suministro.
 *
 * AGING = minutos que el pull lleva esperando: de createdAt a "ahora", o a
 * deliveredAt/canceledAt si el pull ya cerró. Si el aging supera el SLA del pull,
 * el semáforo se pone en rojo (SLA roto).
 */

/** SLA por defecto de un pull (minutos) cuando el pull no trae uno propio. */
export const DEFAULT_PULL_SLA_MINUTES = 120;

/** Umbral de "ámbar": fracción del SLA a partir de la cual el pull está en riesgo. */
export const PULL_SLA_WARN_RATIO = 0.75;

export type PullSemaphore = 'green' | 'amber' | 'red';

/**
 * Minutos de aging de un pull. Cuenta de `createdAt` hasta `endAt` (deliveredAt o
 * canceledAt) si ya cerró; si sigue abierto, hasta `now`. Nunca negativo.
 */
export function computeAgingMinutes(
  createdAt: Date | string | null | undefined,
  endAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!createdAt) return 0;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return 0;
  const endRef = endAt ? new Date(endAt).getTime() : now.getTime();
  const end = Number.isNaN(endRef) ? now.getTime() : endRef;
  const minutes = Math.floor((end - start) / 60000);
  return minutes > 0 ? minutes : 0;
}

/** SLA efectivo del pull: el propio, o el default. */
export function effectiveSla(slaMinutes?: number | null): number {
  return slaMinutes && slaMinutes > 0 ? slaMinutes : DEFAULT_PULL_SLA_MINUTES;
}

/** True si el aging supera el SLA efectivo (semáforo rojo / SLA roto). */
export function isSlaBreached(agingMinutes: number, slaMinutes?: number | null): boolean {
  return agingMinutes > effectiveSla(slaMinutes);
}

/** Semáforo del pull: verde / ámbar (en riesgo) / rojo (SLA roto). */
export function pullSemaphore(agingMinutes: number, slaMinutes?: number | null): PullSemaphore {
  const sla = effectiveSla(slaMinutes);
  if (agingMinutes > sla) return 'red';
  if (agingMinutes >= sla * PULL_SLA_WARN_RATIO) return 'amber';
  return 'green';
}
