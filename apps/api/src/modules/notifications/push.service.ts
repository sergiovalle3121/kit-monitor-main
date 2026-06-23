import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

export interface PushPayload {
  title: string;
  body?: string | null;
  href?: string | null;
  kind?: string | null;
}

/** Forma que envía el navegador (PushSubscription serializada). */
export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Web Push (VAPID) por usuario. Se activa SOLO si están definidas las llaves
 * `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`; de lo contrario opera en modo no-op
 * (el buzón y el socket siguen funcionando igual). Mismo criterio honesto que el
 * prefijo GS1: la función existe completa, pero requiere configurar un secreto
 * para emitir de verdad — nunca finge.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
  private readonly privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
  private readonly subject = process.env.VAPID_SUBJECT ?? 'mailto:ops@axos.os';
  private configured = false;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
    private readonly tenantCtx: TenantContextService,
  ) {
    if (this.publicKey && this.privateKey) {
      try {
        webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
        this.configured = true;
      } catch (err) {
        this.logger.warn(
          `VAPID inválido — web-push deshabilitado: ${(err as Error).message}`,
        );
      }
    } else {
      this.logger.log(
        'VAPID no configurado — web-push en modo no-op (define VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY para activarlo).',
      );
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /** Llave pública que el cliente necesita para `pushManager.subscribe()`. */
  getPublicKey(): string | null {
    return this.configured ? this.publicKey : null;
  }

  /** Alta/actualización idempotente por endpoint (un navegador = una fila). */
  async subscribe(
    userId: string,
    sub: BrowserSubscription,
    userAgent?: string | null,
  ): Promise<{ ok: boolean }> {
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return { ok: false };
    }
    const existing = await this.repo.findOne({
      where: { endpoint: sub.endpoint },
    });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = sub.keys.p256dh;
      existing.auth = sub.keys.auth;
      existing.userAgent = userAgent ?? existing.userAgent ?? null;
      await this.repo.save(existing);
      return { ok: true };
    }
    const entity = this.repo.create({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    await this.repo.save(entity);
    return { ok: true };
  }

  async unsubscribe(userId: string, endpoint: string): Promise<{ ok: boolean }> {
    if (!endpoint) return { ok: false };
    await this.repo.delete({ userId, endpoint });
    return { ok: true };
  }

  /**
   * Empuja un aviso a TODOS los navegadores suscritos del usuario. Best-effort:
   * nunca lanza (el llamador no debe romperse si el push falla) y purga las
   * suscripciones muertas (404/410) para no reintentarlas.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.configured || !userId) return;
    const subs = await this.repo.find({ where: { userId } });
    if (subs.length === 0) return;
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await this.repo.delete({ id: s.id }).catch(() => undefined);
          } else {
            this.logger.warn(
              `Web push falló (${code ?? '?'}): ${(err as Error)?.message}`,
            );
          }
        }
      }),
    );
  }
}
