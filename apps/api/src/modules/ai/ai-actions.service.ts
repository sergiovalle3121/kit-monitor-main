import { ForbiddenException, Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { QualityService } from '../quality/quality.service';
import { ErpMmService } from '../erp-core/services/erp-mm.service';
import { PlansService } from '../plans/plans.service';
import { EhsService } from '../ehs/ehs.service';
import { ACTIONS } from './ai-actions';
import type { ReqUser } from './ai.service';

/**
 * Executes a CIDE-proposed action AFTER the human confirmed it. This is the only
 * place a chat-originated write happens, and it re-checks everything (never
 * trusts the client): the action must exist, the caller must hold the action's
 * write permission, and the params are re-validated. Each underlying domain
 * service records its own Event Ledger entry, so the action is auditable.
 */
@Injectable()
export class AiActionsService {
  private readonly logger = new Logger(AiActionsService.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  private svc<T>(type: Type<T>): T {
    return this.moduleRef.get(type, { strict: false });
  }

  /** Whether the caller may propose/execute an action (admin bypasses RBAC). */
  can(reqUser: ReqUser, actionKey: string): boolean {
    const def = ACTIONS[actionKey];
    if (!def) return false;
    if (reqUser.role === 'Admin') return true;
    return (reqUser.permissions ?? []).includes(def.requiredPermission);
  }

  async execute(
    reqUser: ReqUser,
    actionKey: string,
    rawParams: Record<string, unknown>,
  ): Promise<{
    ok: boolean;
    summary?: string;
    result?: unknown;
    error?: string;
  }> {
    const def = ACTIONS[actionKey];
    if (!def) return { ok: false, error: `Acción desconocida: ${actionKey}` };

    if (!this.can(reqUser, actionKey)) {
      throw new ForbiddenException(
        'No tienes permiso para ejecutar esta acción.',
      );
    }

    const validation = def.validate(rawParams ?? {});
    if (!validation.ok || !validation.params) {
      return { ok: false, error: validation.error ?? 'Parámetros inválidos.' };
    }
    const params = validation.params;

    try {
      const result = await this.run(reqUser, actionKey, params);
      this.logger.log(`CIDE action executed: ${actionKey} by ${reqUser.email}`);
      return { ok: true, summary: def.summarize(params), result };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`CIDE action failed (${actionKey}): ${message}`);
      return { ok: false, error: `No se pudo ejecutar la acción: ${message}` };
    }
  }

  /** Dispatch a validated action to its domain service (the only write point). */
  private async run(
    reqUser: ReqUser,
    actionKey: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (actionKey) {
      case 'create_maintenance_order': {
        const order = await this.svc(MaintenanceService).createOrder(
          params as never,
        );
        return {
          id: order.id,
          folio: order.folio,
          title: order.title,
          status: order.status,
        };
      }
      case 'release_quality_hold': {
        const hold = await this.svc(QualityService).releaseHold(
          params.holdId as number,
          reqUser.email,
        );
        return { id: hold.id, releasedAt: hold.releasedAt };
      }
      case 'create_purchase_requisition': {
        const pr = await this.svc(ErpMmService).createRequisition({
          partNumber: params.partNumber as string,
          quantity: params.quantity as number,
          needBy: params.needBy as string | undefined,
          description: params.description as string | undefined,
          notes: params.notes as string | undefined,
          source: 'manual',
          createdBy: reqUser.email,
        });
        return {
          id: pr.id,
          prNumber: pr.prNumber,
          status: pr.status,
        };
      }
      case 'create_production_plan': {
        const plan = (await this.svc(PlansService).create(
          params as never,
        )) as { id?: string; workOrder?: string; status?: string };
        return {
          id: plan.id,
          workOrder: plan.workOrder,
          status: plan.status,
        };
      }
      case 'assign_ehs_incident_owner': {
        const inc = await this.svc(EhsService).update(
          params.incidentId as string,
          {
            capaOwner: params.owner as string,
            capaDueDate: params.dueDate as string | undefined,
          } as never,
        );
        return { id: inc.id, capaOwner: inc.capaOwner, status: inc.status };
      }
      case 'set_maintenance_order_status': {
        const order = await this.svc(MaintenanceService).updateOrder(
          params.orderId as string,
          { status: params.status } as never,
        );
        return { id: order.id, folio: order.folio, status: order.status };
      }
      case 'create_safety_incident': {
        const inc = await this.svc(EhsService).create(params as never);
        return { id: inc.id, folio: inc.folio, title: inc.title };
      }
      default:
        throw new Error(`Sin ejecutor para la acción: ${actionKey}`);
    }
  }
}
