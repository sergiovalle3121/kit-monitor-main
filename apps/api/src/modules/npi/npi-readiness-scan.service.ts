import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NpiProject } from './entities/npi-project.entity';
import { NpiGate } from './entities/npi-gate.entity';
import { NpiReadinessSnapshot } from './entities/npi-readiness-snapshot.entity';
import { NpiService } from './npi.service';
import {
  TenantContext,
  TenantContextService,
} from '../../common/tenant/tenant-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { isFinalPhase } from './npi-state';

export interface NpiScanResult {
  scanned: number;
  captured: number;
  becameReady: number;
  stalled: number;
  notified: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Watch-dog for NPI readiness. Mirrors suppliers-alerts / traffic-alerts: a
 * global, tenant-agnostic sweep (run by NpiReadinessScanTask) whose logic and
 * dedupe live here. For every OPEN/ON_HOLD project it derives readiness INSIDE
 * the project's own tenant scope (via TenantContextService.run, since the cron
 * has no request context), snapshots it for history, and pushes an inbox alert
 * when a model first becomes gate-ready or when its current gate goes stale.
 *
 * Best-effort: if Users/Notifications are unavailable, or a project fails, it
 * logs and continues — a scan never crashes the process and never mutates
 * anything outside `npi_`.
 */
@Injectable()
export class NpiReadinessScanService {
  private readonly logger = new Logger(NpiReadinessScanService.name);

  constructor(
    @InjectRepository(NpiProject)
    private readonly projectsRepo: Repository<NpiProject>,
    @InjectRepository(NpiGate)
    private readonly gatesRepo: Repository<NpiGate>,
    private readonly npi: NpiService,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly users?: UsersService,
  ) {}

  private buildContext(project: NpiProject): TenantContext {
    return {
      tenant_id: project.tenant_id,
      organization_id: project.organization_id,
      plant_id: project.plant_id,
      user_email: 'system@npi.scan',
      role: null,
      permissions: null,
      scopes: null,
    };
  }

  async scanAndNotify(
    staleDays = Number(process.env.NPI_GATE_STALE_DAYS) || 14,
  ): Promise<NpiScanResult> {
    const result: NpiScanResult = {
      scanned: 0,
      captured: 0,
      becameReady: 0,
      stalled: 0,
      notified: 0,
    };

    const projects = await this.projectsRepo.find({
      where: { status: In(['OPEN', 'ON_HOLD']) },
    });
    result.scanned = projects.length;
    const today = new Date().toISOString().slice(0, 10);

    for (const project of projects) {
      try {
        await this.tenantCtx.run(this.buildContext(project), async () => {
          const prior = await this.npi.getLatestSnapshot(project.id);
          const snap = await this.npi.captureSnapshot(
            project.modelNumber,
            project.revision,
            {
              projectId: project.id,
              phase: project.currentPhase,
              reason: 'SCAN',
            },
          );
          result.captured += 1;

          // 1) First transition into gate-ready → actionable alert.
          if (snap.gateReady && !(prior?.gateReady ?? false)) {
            result.becameReady += 1;
            if (await this.notifyReady(project, snap, today)) {
              result.notified += 1;
            }
          }

          // 2) Current gate pending too long → stalled alert.
          if (await this.notifyStaleGate(project, staleDays, today)) {
            result.stalled += 1;
            result.notified += 1;
          }
        });
      } catch (err) {
        this.logger.warn(
          `Escaneo NPI falló para ${project.modelNumber}: ${(err as Error)?.message}`,
        );
      }
    }
    return result;
  }

  /** Resolve the project owner's user id from created_by email (null if unknown). */
  private async ownerUserId(project: NpiProject): Promise<string | null> {
    if (!this.users || !project.created_by) return null;
    const user = await this.users
      .findOneByEmail(project.created_by)
      .catch(() => null);
    return user?.id ?? null;
  }

  private async notifyReady(
    project: NpiProject,
    snap: NpiReadinessSnapshot,
    day: string,
  ): Promise<boolean> {
    if (!this.notifications) return false;
    const userId = await this.ownerUserId(project);
    if (!userId) return false;
    try {
      await this.notifications.create({
        userId,
        kind: 'npi',
        severity: 'medium',
        domain: 'engineering',
        source: 'NPI',
        title: `NPI listo · ${project.modelNumber} rev ${project.revision}`,
        body: `Todos los criterios de readiness están en verde (${snap.readyCount}/${snap.readyCount}). El modelo está listo para avanzar de gate.`,
        dedupeKey: `npi-gate-ready:${project.id}:${day}`,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `No se pudo avisar readiness de ${project.modelNumber}: ${(err as Error)?.message}`,
      );
      return false;
    }
  }

  private async notifyStaleGate(
    project: NpiProject,
    staleDays: number,
    day: string,
  ): Promise<boolean> {
    if (!this.notifications) return false;
    // The gate of the project's current (advisory) phase — the one awaiting a
    // decision. A released/MP project is not "stalled".
    if (isFinalPhase(project.currentPhase)) return false;
    const gate = await this.gatesRepo.findOne({
      where: { projectId: project.id, phase: project.currentPhase },
    });
    if (!gate || gate.status !== 'PENDING') return false;
    const ageMs = Date.now() - new Date(gate.created_at).getTime();
    if (ageMs < staleDays * DAY_MS) return false;

    const userId = await this.ownerUserId(project);
    if (!userId) return false;
    const ageDays = Math.floor(ageMs / DAY_MS);
    try {
      await this.notifications.create({
        userId,
        kind: 'npi',
        severity: 'high',
        domain: 'engineering',
        source: 'NPI',
        title: `Gate NPI estancado · ${project.modelNumber} (${project.currentPhase})`,
        body: `El gate ${project.currentPhase} lleva ${ageDays} día(s) en PENDING sin decisión.`,
        dedupeKey: `npi-gate-stale:${project.id}:${project.currentPhase}:${day}`,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `No se pudo avisar gate estancado de ${project.modelNumber}: ${(err as Error)?.message}`,
      );
      return false;
    }
  }
}
