import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { AiToolsService, ToolContext } from './ai-tools.service';
import { buildSituationReport, Insight } from './ai-insights';
import type { ReqUser } from './ai.service';

/**
 * CIDE "Centinela" — builds the proactive situation report by running the
 * read-only grounding tools under the caller's RBAC and ranking the findings.
 * Deterministic (no LLM), so it works even before the engine is provisioned.
 */
@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly tools: AiToolsService,
  ) {}

  private async buildContext(reqUser: ReqUser): Promise<ToolContext> {
    let userEntity: User;
    try {
      userEntity = await this.moduleRef
        .get(UsersService, { strict: false })
        .findOne(reqUser.userId);
    } catch {
      userEntity = {
        id: reqUser.userId,
        email: reqUser.email,
        role: reqUser.role,
        permissions: reqUser.permissions ?? [],
        scopes: {},
      } as unknown as User;
    }
    return {
      user: userEntity,
      isAdmin: reqUser.role === 'Admin',
      permissions: reqUser.permissions ?? [],
    };
  }

  /** Run a grounding tool, swallowing RBAC/errors (returns null so it's skipped). */
  private async safe(tool: string, ctx: ToolContext): Promise<unknown> {
    try {
      return await this.tools.execute(tool, {}, ctx);
    } catch (e) {
      this.logger.warn(
        `Insight source ${tool} failed: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  async situationReport(
    reqUser: ReqUser,
  ): Promise<{ generatedAt: string; insights: Insight[] }> {
    const ctx = await this.buildContext(reqUser);
    const [kpiAlerts, maintenance, qualityHolds, ehs] = await Promise.all([
      this.safe('kpi_alerts', ctx),
      this.safe('maintenance_orders', ctx),
      this.safe('quality_holds', ctx),
      this.safe('safety_incidents', ctx),
    ]);
    const insights = buildSituationReport(
      { kpiAlerts, maintenance, qualityHolds, ehs },
      Date.now(),
    );
    return { generatedAt: new Date().toISOString(), insights };
  }
}
