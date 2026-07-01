import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certification } from './entities/certification.entity';
import { daysToExpiry } from './cert-status';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ownerEmails } from '../auth/rbac';

export interface RecertScanResult {
  scanned: number;
  expiring: number;
  expired: number;
  notified: number;
  unresolved: number;
}

/**
 * Productor de alertas de recertificación: barre las certificaciones por vencer
 * (ventana configurable) y vencidas, y deposita un aviso deduplicado en el buzón
 * (`NotificationsService`) del operador (si tiene cuenta de sistema) y del/los
 * owner(s) — así RH siempre ve el feed aunque el operador no tenga usuario.
 *
 * Aditivo y best-effort: si Users/Notifications no están disponibles, no-opera.
 * Corre por cron (PeopleAlertsTask) sin contexto de tenant — barre global.
 */
@Injectable()
export class PeopleAlertsService {
  private readonly logger = new Logger(PeopleAlertsService.name);

  constructor(
    @InjectRepository(Certification)
    private readonly repo: Repository<Certification>,
    @Optional() private readonly users?: UsersService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async scanRecertAndNotify(
    windowDays = Number(process.env.PEOPLE_RECERT_WINDOW_DAYS) || 30,
  ): Promise<RecertScanResult> {
    const result: RecertScanResult = {
      scanned: 0,
      expiring: 0,
      expired: 0,
      notified: 0,
      unresolved: 0,
    };
    if (!this.notifications) return result;

    const certs = await this.repo.find({ where: { active: true } });
    result.scanned = certs.length;

    // Memoiza la resolución de destinatarios por email de empleado: antes se
    // re-buscaban (empleado + owners) por CADA certificación (N+1 en el cron);
    // los owners son constantes y un empleado suele tener varias certificaciones.
    const recipientCache = new Map<string, { id: string }[]>();

    for (const c of certs) {
      if (!c.expiresDate) continue;
      const d = daysToExpiry(c.expiresDate);
      if (d === null) continue;
      const isExpired = d < 0;
      const isExpiring = d >= 0 && d <= windowDays;
      if (!isExpired && !isExpiring) continue;
      if (isExpired) result.expired += 1;
      else result.expiring += 1;

      const cacheKey = c.employeeEmail ?? '';
      let recipients = recipientCache.get(cacheKey);
      if (!recipients) {
        recipients = await this.resolveRecipients(c.employeeEmail);
        recipientCache.set(cacheKey, recipients);
      }
      if (recipients.length === 0) {
        result.unresolved += 1;
        continue;
      }

      const expDate = new Date(c.expiresDate).toISOString().slice(0, 10);
      const status = isExpired ? 'expired' : 'expiring';
      const dedupeKey = `cert-expiry:${c.id}:${status}:${expDate}`;
      const title = isExpired
        ? `Certificación vencida: ${c.skill}`
        : `Certificación por vencer: ${c.skill}`;
      const body = [
        c.employeeName,
        c.station ? `estación ${c.station}` : null,
        isExpired ? `venció el ${expDate}` : `vence el ${expDate} (${d}d)`,
      ]
        .filter(Boolean)
        .join(' · ');

      for (const user of recipients) {
        try {
          await this.notifications.create({
            userId: user.id,
            kind: 'cert-expiry',
            severity: isExpired ? 'critical' : 'high',
            title,
            body,
            domain: 'people',
            source: 'Skills',
            href: '/dashboard',
            dedupeKey,
          });
          result.notified += 1;
        } catch (err) {
          this.logger.warn(
            `No se pudo crear aviso de recert: ${(err as Error)?.message}`,
          );
        }
      }
    }
    return result;
  }

  /** Operador (por email) + owner(s), deduplicados por id de usuario. */
  private async resolveRecipients(
    employeeEmail: string | null,
  ): Promise<{ id: string }[]> {
    if (!this.users) return [];
    const map = new Map<string, { id: string }>();
    const add = async (email?: string | null): Promise<void> => {
      if (!email) return;
      try {
        const u = await this.users!.findOneByEmail(email);
        if (u) map.set(u.id, u);
      } catch {
        /* best-effort */
      }
    };
    await add(employeeEmail);
    for (const oe of ownerEmails()) await add(oe);
    return [...map.values()];
  }
}
