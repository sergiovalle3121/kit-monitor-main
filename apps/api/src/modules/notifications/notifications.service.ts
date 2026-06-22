import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { UserNotification } from './entities/notification.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { SignalGateway } from '../../common/gateway/signal.gateway';
import { PushService } from './push.service';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  kind?: string;
  severity?: string;
  body?: string | null;
  source?: string | null;
  domain?: string | null;
  href?: string | null;
  dedupeKey?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(getTenantRepositoryToken(UserNotification))
    private readonly repo: TenantScopedRepository<UserNotification>,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly signals?: SignalGateway,
    @Optional() private readonly push?: PushService,
  ) {}

  async list(
    userId: string,
    opts: { unreadOnly?: boolean; kind?: string; limit?: number } = {},
  ): Promise<UserNotification[]> {
    const qb = this.repo.createQueryBuilder('n').orderBy('n.created_at', 'DESC');
    const tenant = this.tenantCtx.getTenantId();
    if (tenant) qb.andWhere('n.tenant_id = :tenant', { tenant });
    else qb.andWhere('n.tenant_id IS NULL');
    qb.andWhere('n.user_id = :userId', { userId });
    if (opts.unreadOnly) qb.andWhere('n.read_at IS NULL');
    if (opts.kind) qb.andWhere('n.kind = :k', { k: opts.kind });
    qb.take(Math.min(Math.max(opts.limit ?? 100, 1), 500));
    return qb.getMany();
  }

  async counts(userId: string): Promise<{ all: number; unread: number }> {
    const rows = await this.list(userId, { limit: 500 });
    return { all: rows.length, unread: rows.filter((r) => !r.readAt).length };
  }

  async markRead(userId: string, id: string): Promise<{ success: boolean }> {
    const n = await this.repo.findOne({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notificación no encontrada.');
    if (!n.readAt) {
      n.readAt = new Date();
      await this.repo.save(n);
    }
    return { success: true };
  }

  async markUnread(userId: string, id: string): Promise<{ success: boolean }> {
    const n = await this.repo.findOne({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notificación no encontrada.');
    if (n.readAt) {
      n.readAt = null;
      await this.repo.save(n);
    }
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: boolean; updated: number }> {
    const unread = await this.list(userId, { unreadOnly: true, limit: 500 });
    const now = new Date();
    for (const n of unread) {
      n.readAt = now;
      await this.repo.save(n);
    }
    return { success: true, updated: unread.length };
  }

  /**
   * Crea (o reusa, por `dedupeKey`) una notificación para un usuario. Lo llaman el
   * seed y, a futuro, los productores (andon/holds/aprobaciones…). Tras guardar,
   * empuja `notification:new` por el socket de planta del tenant (best-effort).
   */
  async create(input: CreateNotificationInput): Promise<UserNotification> {
    if (input.dedupeKey) {
      const existing = await this.repo.findOne({
        where: { dedupeKey: input.dedupeKey, userId: input.userId },
      });
      if (existing) return existing;
    }
    const entity = this.repo.create({
      userId: input.userId,
      kind: input.kind ?? 'system',
      severity: input.severity ?? 'info',
      title: input.title,
      body: input.body ?? null,
      source: input.source ?? null,
      domain: input.domain ?? null,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey ?? null,
      readAt: null,
      archivedAt: null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    try {
      if (saved.tenant_id && this.signals) {
        this.signals.emitToTenant(saved.tenant_id, 'notification:new', {
          id: saved.id,
          userId: saved.userId,
          kind: saved.kind,
          title: saved.title,
        });
      }
    } catch (err) {
      this.logger.warn(`No se pudo emitir notification:new: ${(err as Error)?.message}`);
    }
    // Web push best-effort: no-op si VAPID no está configurado o el usuario no
    // tiene navegadores suscritos. Nunca debe romper la creación del aviso.
    this.push
      ?.sendToUser(saved.userId, {
        title: saved.title,
        body: saved.body,
        href: saved.href,
        kind: saved.kind,
      })
      .catch((err) =>
        this.logger.warn(`No se pudo enviar web push: ${(err as Error)?.message}`),
      );
    return saved;
  }
}
