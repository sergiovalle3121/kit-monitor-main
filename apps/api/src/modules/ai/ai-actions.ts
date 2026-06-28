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

/** Coerce a value (number or numeric string) to a finite number, else undefined. */
function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
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

  release_quality_hold: {
    key: 'release_quality_hold',
    label: 'Liberar retención de calidad',
    requiredPermission: 'QUALITY_APPROVE',
    validate(raw) {
      const holdId = num(raw.holdId);
      if (holdId === undefined || holdId <= 0) {
        return {
          ok: false,
          error: 'Indica el ID numérico de la retención (holdId) a liberar.',
        };
      }
      return { ok: true, params: { holdId } };
    },
    summarize(p) {
      return `Liberar la retención de calidad #${String(p.holdId)}`;
    },
  },

  create_purchase_requisition: {
    key: 'create_purchase_requisition',
    label: 'Crear requisición de compra',
    requiredPermission: 'materials:write',
    validate(raw) {
      const partNumber = str(raw.partNumber);
      if (!partNumber) {
        return { ok: false, error: 'Indica el número de parte (partNumber).' };
      }
      const quantity = num(raw.quantity);
      if (quantity === undefined || quantity <= 0) {
        return { ok: false, error: 'Indica una cantidad (quantity) mayor a 0.' };
      }
      const params: Record<string, unknown> = { partNumber, quantity };
      const needBy = str(raw.needBy);
      if (needBy) params.needBy = needBy;
      const description = str(raw.description);
      if (description) params.description = description;
      const notes = str(raw.notes);
      if (notes) params.notes = notes;
      return { ok: true, params };
    },
    summarize(p) {
      const parts = [
        `Crear requisición de compra: ${String(p.quantity)} × ${String(p.partNumber)}`,
      ];
      if (p.needBy) parts.push(`para ${String(p.needBy)}`);
      return parts.join(' · ');
    },
  },

  create_production_plan: {
    key: 'create_production_plan',
    label: 'Crear orden / plan de producción',
    requiredPermission: 'MANAGE_PLANS',
    validate(raw) {
      const model = str(raw.model);
      if (!model) {
        return { ok: false, error: 'Indica el modelo/producto (model).' };
      }
      const line = num(raw.line);
      if (line === undefined || line < 1 || line > 7) {
        return { ok: false, error: 'Indica la línea (line), un número de 1 a 7.' };
      }
      const quantity = num(raw.quantity);
      if (quantity === undefined || quantity <= 0) {
        return { ok: false, error: 'Indica una cantidad (quantity) mayor a 0.' };
      }
      const shift = str(raw.shift)?.toUpperCase();
      if (!shift || !['T1', 'T2', 'T3'].includes(shift)) {
        return { ok: false, error: 'Indica el turno (shift): T1, T2 o T3.' };
      }
      const params: Record<string, unknown> = { model, line, quantity, shift };
      const workOrder = str(raw.workOrder);
      if (workOrder) params.workOrder = workOrder;
      const bahia = num(raw.bahia);
      if (bahia !== undefined && bahia >= 1 && bahia <= 6) params.bahia = bahia;
      const scheduledAt = str(raw.scheduledAt);
      if (scheduledAt) params.scheduledAt = scheduledAt;
      return { ok: true, params };
    },
    summarize(p) {
      const parts = [
        `Crear plan de producción: ${String(p.quantity)} × ${String(p.model)}`,
        `línea ${String(p.line)}`,
        `turno ${String(p.shift)}`,
      ];
      if (p.scheduledAt) parts.push(`programado ${String(p.scheduledAt)}`);
      return parts.join(' · ');
    },
  },

  assign_ehs_incident_owner: {
    key: 'assign_ehs_incident_owner',
    label: 'Asignar responsable de incidente EHS',
    requiredPermission: 'reports:read',
    validate(raw) {
      const incidentId = str(raw.incidentId);
      if (!incidentId) {
        return { ok: false, error: 'Indica el ID del incidente (incidentId).' };
      }
      const owner = str(raw.owner);
      if (!owner) {
        return { ok: false, error: 'Indica el responsable (owner).' };
      }
      const params: Record<string, unknown> = { incidentId, owner };
      const dueDate = str(raw.dueDate);
      if (dueDate) params.dueDate = dueDate;
      return { ok: true, params };
    },
    summarize(p) {
      const parts = [
        `Asignar a "${String(p.owner)}" como responsable del incidente ${String(p.incidentId)}`,
      ];
      if (p.dueDate) parts.push(`vence ${String(p.dueDate)}`);
      return parts.join(' · ');
    },
  },
};

export const ACTION_KEYS = Object.keys(ACTIONS);
