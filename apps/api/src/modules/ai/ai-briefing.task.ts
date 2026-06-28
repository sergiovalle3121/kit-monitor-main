import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ModuleRef } from '@nestjs/core';
import { SemanticService } from '../semantic/semantic.service';
import { BriefsService } from '../semantic/briefs.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_TENANT = '__default__';

/** Match an admin to a tenant (default tenant covers users with no tenant). */
export function sameTenant(
  userTenant: string | null | undefined,
  tenant: string,
): boolean {
  if (tenant === DEFAULT_TENANT) return !userTenant || userTenant === DEFAULT_TENANT;
  return userTenant === tenant;
}

/**
 * CIDE proactive briefing — turns the daily Decision Brief (semantic) into a
 * push to each tenant's admins when it carries alerts. Reuses the existing
 * tenant-safe brief generation and the notifications inbox; cross-module
 * services are resolved lazily via ModuleRef so this adds no module coupling.
 * Idempotent per tenant/day/admin via the notification dedupe key. Off with
 * CIDE_BRIEF_PUSH_ENABLED=false; cron tunable via CIDE_BRIEF_PUSH_CRON.
 */
@Injectable()
export class AiBriefingTask {
  private readonly logger = new Logger(AiBriefingTask.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  @Cron(process.env.CIDE_BRIEF_PUSH_CRON || CronExpression.EVERY_DAY_AT_7AM, {
    name: 'cide:brief-push',
  })
  async handle(): Promise<void> {
    if (process.env.CIDE_BRIEF_PUSH_ENABLED === 'false') return;
    try {
      const pushed = await this.run();
      this.logger.log(`CIDE brief push: ${pushed} notificación(es) a admins.`);
    } catch (e) {
      this.logger.warn(
        `CIDE brief push falló: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /** Core (separated for testing): returns how many notifications were created. */
  async run(): Promise<number> {
    const semantic = this.moduleRef.get(SemanticService, { strict: false });
    const briefs = this.moduleRef.get(BriefsService, { strict: false });
    const users = this.moduleRef.get(UsersService, { strict: false });
    const notifs = this.moduleRef.get(NotificationsService, { strict: false });

    let tenants: string[] = [DEFAULT_TENANT];
    try {
      const found = await semantic.listTenants();
      if (Array.isArray(found) && found.length) tenants = found;
    } catch {
      /* fall back to the default tenant */
    }

    const admins = await users.listByPermission('ADMIN_ACCESS');
    let pushed = 0;
    for (const t of tenants) {
      const { latest } = await briefs.listForTenant(t, 1);
      if (!latest || (latest.alertsCount ?? 0) === 0) continue;
      const recipients = admins.filter((u) => sameTenant(u.tenantId, t));
      for (const u of recipients) {
        await notifs.create({
          userId: u.id,
          title: `CIDE: ${latest.headline}`,
          body: (latest.summary ?? '').slice(0, 400) || null,
          kind: 'cide_brief',
          severity: latest.criticalCount > 0 ? 'critical' : 'warning',
          source: 'CIDE',
          domain: 'INTELLIGENCE',
          href: '/dashboard/intelligence',
          dedupeKey: `cide-brief:${t}:${latest.periodKey}:${u.id}`,
        });
        pushed++;
      }
    }
    return pushed;
  }
}
