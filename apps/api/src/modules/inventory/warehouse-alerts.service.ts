import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WarehouseTask, WarehouseTaskStatus } from './entities/warehouse-task.entity';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ownerEmails } from '../auth/rbac';
import { computeAgingMinutes, effectiveSla, isSlaBreached } from './pull.util';

export interface PullAlertScanResult {
  scanned: number;
  breached: number;
  urgent: number;
  notified: number;
  unresolved: number;
}

/**
 * Productor de alertas del Pull Monitor: barre los pulls ABIERTOS y deposita
 * avisos deduplicados en el buzón (`NotificationsService`):
 *   • SLA roto (aging > SLA)      → supervisor de materiales (Materials Lead /
 *                                    Admin / owner) — el que vigila la planta.
 *   • Pull urgente nuevo          → handler (Warehouse Operator) que lo surte.
 *
 * Mismo patrón que las alertas de tráfico (#579): aditivo y best-effort — si
 * Users/Notifications no están, no-opera. Corre por cron (WarehouseAlertsTask)
 * sin contexto de tenant (barre global; el aviso queda con tenant nulo). Dedupe
 * POR PULL (`warehouse-sla:<folio>` / `warehouse-urgent:<folio>`) para no spamear.
 * Filtra destinatarios por scope de almacén cuando el usuario lo tiene acotado.
 */
@Injectable()
export class WarehouseAlertsService {
  private readonly logger = new Logger(WarehouseAlertsService.name);

  constructor(
    @InjectRepository(WarehouseTask)
    private readonly tasks: Repository<WarehouseTask>,
    @Optional() private readonly users?: UsersService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async scanPullSlaAndNotify(): Promise<PullAlertScanResult> {
    const result: PullAlertScanResult = { scanned: 0, breached: 0, urgent: 0, notified: 0, unresolved: 0 };
    if (!this.notifications) return result;

    const open = await this.tasks.find({
      where: { status: In([WarehouseTaskStatus.PENDING, WarehouseTaskStatus.IN_PROGRESS]) },
    });
    result.scanned = open.length;
    if (open.length === 0) return result;

    const { supervisors, handlers } = await this.resolveRecipients();
    const now = new Date();

    for (const pull of open) {
      const aging = computeAgingMinutes(pull.createdAt, null, now);
      const sla = effectiveSla(pull.slaMinutes);

      // SLA roto → supervisor del almacén
      if (isSlaBreached(aging, pull.slaMinutes)) {
        result.breached += 1;
        const recips = this.scopeFilter(supervisors, pull.fromWarehouseId);
        if (recips.length === 0) result.unresolved += 1;
        const critical = aging > sla * 2;
        for (const u of recips) {
          if (
            await this.push(u.id, {
              kind: 'warehouse-sla',
              severity: critical ? 'critical' : 'high',
              title: `Pull ${pull.taskNumber} con SLA roto`,
              body: `${pull.partNumber} · ${pull.project ?? 'sin proyecto'} · ${this.fmt(aging)} esperando (SLA ${this.fmt(sla)})`,
              dedupeKey: `warehouse-sla:${pull.taskNumber}`,
            })
          ) {
            result.notified += 1;
          }
        }
      }

      // Pull urgente nuevo → handler que lo surte
      if (pull.urgent) {
        result.urgent += 1;
        const recips = this.scopeFilter(handlers.length ? handlers : supervisors, pull.fromWarehouseId);
        if (recips.length === 0) result.unresolved += 1;
        for (const u of recips) {
          if (
            await this.push(u.id, {
              kind: 'warehouse-urgent',
              severity: 'high',
              title: `Pull urgente ${pull.taskNumber}`,
              body: `${pull.partNumber} · ${pull.project ?? 'sin proyecto'} → ${pull.toLocation ?? pull.toWarehouseId}`,
              dedupeKey: `warehouse-urgent:${pull.taskNumber}`,
            })
          ) {
            result.notified += 1;
          }
        }
      }
    }
    return result;
  }

  /** Envía un aviso al buzón (best-effort). Devuelve true si se creó/dedupeó. */
  private async push(
    userId: string,
    n: { kind: string; severity: string; title: string; body: string; dedupeKey: string },
  ): Promise<boolean> {
    try {
      await this.notifications!.create({
        userId,
        domain: 'materials',
        source: 'Almacén',
        href: '/dashboard/warehouse',
        ...n,
      });
      return true;
    } catch (err) {
      this.logger.warn(`No se pudo crear aviso de almacén: ${(err as Error)?.message}`);
      return false;
    }
  }

  /**
   * Supervisores (Materials Lead / Admin / owner) y handlers (Warehouse Operator),
   * deduplicados por id. Una sola consulta de usuarios activos.
   */
  private async resolveRecipients(): Promise<{ supervisors: User[]; handlers: User[] }> {
    if (!this.users) return { supervisors: [], handlers: [] };

    const active = await this.safe(() => this.users!.findByStatus('active'), [] as User[]);

    const supMap = new Map<string, User>();
    for (const email of ownerEmails()) {
      const u = await this.safe(() => this.users!.findOneByEmail(email), null);
      if (u) supMap.set(u.id, u);
    }
    for (const u of active) {
      if (u.role === UserRole.ADMIN || u.role === UserRole.MATERIALS_LEAD) supMap.set(u.id, u);
    }

    const handlers = active.filter((u) => u.role === UserRole.WAREHOUSE_OPERATOR);
    return { supervisors: [...supMap.values()], handlers };
  }

  /** Incluye al usuario si no tiene scope de almacén (ve todo) o si cubre ese almacén. */
  private scopeFilter(users: User[], warehouseId?: string): User[] {
    if (!warehouseId) return users;
    return users.filter((u) => {
      const whs = u.scopes?.warehouses;
      if (!whs || whs.length === 0) return true; // sin acotar → ve todos
      return whs.includes(warehouseId);
    });
  }

  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  private fmt(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
}
