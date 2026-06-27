import { ForbiddenException, Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MaintenanceService } from '../maintenance/maintenance.service';
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
      const result = await this.run(actionKey, params);
      this.logger.log(`CIDE action executed: ${actionKey} by ${reqUser.email}`);
      return { ok: true, summary: def.summarize(params), result };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`CIDE action failed (${actionKey}): ${message}`);
      return { ok: false, error: `No se pudo ejecutar la acción: ${message}` };
    }
  }

  /** Dispatch a validated action to its domain service. */
  private async run(
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
      default:
        throw new Error(`Sin ejecutor para la acción: ${actionKey}`);
    }
  }
}
