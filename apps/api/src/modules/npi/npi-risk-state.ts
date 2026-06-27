/**
 * NPI risk vocabulary — pure constants/helpers, no DB or Nest. Risks are an
 * additive, advisory register on a launch (owner / severity / due date / status);
 * they inform the dossier and the "what's missing" view but never block a gate.
 */

export type NpiRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type NpiRiskStatus = 'OPEN' | 'MITIGATING' | 'CLOSED';

export const NPI_RISK_SEVERITIES: NpiRiskSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];
export const NPI_RISK_STATUSES: NpiRiskStatus[] = [
  'OPEN',
  'MITIGATING',
  'CLOSED',
];

/** Higher = more urgent; used to sort the register (open + severe first). */
export const RISK_SEVERITY_RANK: Record<NpiRiskSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/** A risk still weighs on the launch until it is CLOSED. */
export function isRiskOpen(status: NpiRiskStatus): boolean {
  return status !== 'CLOSED';
}
