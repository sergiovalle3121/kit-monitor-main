/**
 * CIDE write-action registry — the human-in-the-loop catalog.
 *
 * Until now CIDE was strictly read-only (see DECISIONS §22/§23). This registry
 * introduces a deliberate, narrow exception: CIDE may *propose* an action, but
 * it NEVER executes on its own. The model calls `propose_action`, which only
 * validates and returns a structured proposal rendered as a confirmation card;
 * the actual mutation happens only when the human clicks confirm, which calls
 * the RBAC-gated `POST /ai/actions/execute` with the caller's own permissions.
 *
 * This module is pure (validation + summaries) so it can be unit-tested without
 * touching the database; the executor wiring lives in `ai-actions.service.ts`.
 */

export interface ActionValidation {
  ok: boolean;
  /** Normalized params to persist when ok. */
  params?: Record<string, unknown>;
  /** User-facing reason when not ok. */
  error?: string;
}

export interface ActionDef {
  key: string;
  /** Short human label for the confirmation card. */
  label: string;
  /** RBAC permission the caller must hold (admins bypass) to propose/execute. */
  requiredPermission: string;
  /** Validate + normalize raw params (from the model or the confirm call). */
  validate(raw: Record<string, unknown>): ActionValidation;
  /** One-line human summary of what will happen, for the confirmation card. */
  summarize(params: Record<string, unknown>): string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

const MO_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE'];
const MO_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

/** The only actions CIDE is allowed to propose/execute (start narrow). */
export const ACTIONS: Record<string, ActionDef> = {
  create_maintenance_order: {
    key: 'create_maintenance_order',
    label: 'Crear orden de mantenimiento',
    requiredPermission: 'maintenance:write',
    validate(raw) {
      const title = str(raw.title);
      if (!title || title.length < 3 || title.length > 200) {
        return {
          ok: false,
          error: 'Indica un título de 3 a 200 caracteres para la orden.',
        };
      }
      const type = str(raw.type)?.toUpperCase();
      if (type && !MO_TYPES.includes(type)) {
        return {
          ok: false,
          error: `Tipo inválido. Usa: ${MO_TYPES.join(', ')}.`,
        };
      }
      const priority = str(raw.priority)?.toUpperCase();
      if (priority && !MO_PRIORITIES.includes(priority)) {
        return {
          ok: false,
          error: `Prioridad inválida. Usa: ${MO_PRIORITIES.join(', ')}.`,
        };
      }
      const params: Record<string, unknown> = { title };
      const description = str(raw.description);
      if (description) params.description = description;
      if (type) params.type = type;
      if (priority) params.priority = priority;
      const assetId = str(raw.assetId);
      if (assetId) params.assetId = assetId;
      const assignedTo = str(raw.assignedTo);
      if (assignedTo) params.assignedTo = assignedTo;
      const dueDate = str(raw.dueDate);
      if (dueDate) params.dueDate = dueDate;
      return { ok: true, params };
    },
    summarize(p) {
      const parts = [`Crear orden de mantenimiento: "${String(p.title)}"`];
      if (p.type) parts.push(`tipo ${String(p.type)}`);
      if (p.priority) parts.push(`prioridad ${String(p.priority)}`);
      if (p.assetId) parts.push(`activo ${String(p.assetId)}`);
      if (p.dueDate) parts.push(`vence ${String(p.dueDate)}`);
      return parts.join(' · ');
    },
  },
};

export const ACTION_KEYS = Object.keys(ACTIONS);
