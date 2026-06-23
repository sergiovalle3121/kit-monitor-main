import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoadingDock } from './entities/loading-dock.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ownerEmails } from '../auth/rbac';

export interface DockOverstayScanResult {
  scanned: number;
  occupied: number;
  overstay: number;
  notified: number;
  unresolved: number;
}

/**
 * Productor de alertas de patio: barre los andenes OCUPADOS cuya antigüedad
 * (`occupied_at`) supera el umbral y deposita un aviso deduplicado en el buzón
 * (`NotificationsService`) del/los owner(s) — así el coordinador de tráfico ve la
 * sobreestadía aunque no esté en la pantalla del Tablero. Cierra la pieza de
 * alertas de la sección 4 ("andén ocupado más allá del umbral") usando SÓLO la
 * entidad propia de traffic (cero acoplamiento con outbound).
 *
 * Aditivo y best-effort: si Users/Notifications no están disponibles, no-opera.
 * Corre por cron (TrafficAlertsTask) sin contexto de tenant — barre global.
 * Dedupe por episodio de ocupación: `dock-overstay:<dockId>:<occupiedAtIso>`, así
 * el mismo andén ocupado no spamea, pero una nueva ocupación sí genera un aviso.
 */
@Injectable()
export class TrafficAlertsService {
  private readonly logger = new Logger(TrafficAlertsService.name);

  constructor(
    @InjectRepository(LoadingDock)
    private readonly docks: Repository<LoadingDock>,
    @Optional() private readonly users?: UsersService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async scanDockOverstayAndNotify(
    thresholdMin = Number(process.env.TRAFFIC_DOCK_OVERSTAY_MIN) || 240,
  ): Promise<DockOverstayScanResult> {
    const result: DockOverstayScanResult = {
      scanned: 0,
      occupied: 0,
      overstay: 0,
      notified: 0,
      unresolved: 0,
    };
    if (!this.notifications) return result;

    const occupied = await this.docks.find({ where: { status: 'occupied' } });
    result.scanned = occupied.length;
    result.occupied = occupied.length;
    if (occupied.length === 0) return result;

    const recipients = await this.resolveOwners();

    for (const k of occupied) {
      if (!k.occupiedAt) continue;
      const mins = Math.floor(
        (Date.now() - new Date(k.occupiedAt).getTime()) / 60000,
      );
      if (mins < thresholdMin) continue;
      result.overstay += 1;

      if (recipients.length === 0) {
        result.unresolved += 1;
        continue;
      }

      const occupiedIso = new Date(k.occupiedAt).toISOString();
      const dedupeKey = `dock-overstay:${k.id}:${occupiedIso}`;
      const critical = mins >= thresholdMin * 2;
      const title = `Andén ${k.code} con sobreestadía`;
      const body = [
        k.name || `Andén ${k.code}`,
        `lleva ${this.fmtMins(mins)} ocupado`,
        `(umbral ${this.fmtMins(thresholdMin)})`,
        k.loadingStartedAt ? 'en carga' : null,
      ]
        .filter(Boolean)
        .join(' · ');

      for (const user of recipients) {
        try {
          await this.notifications.create({
            userId: user.id,
            kind: 'dock-overstay',
            severity: critical ? 'critical' : 'high',
            title,
            body,
            domain: 'logistics',
            source: 'Tráfico',
            href: '/dashboard/traffic',
            dedupeKey,
          });
          result.notified += 1;
        } catch (err) {
          this.logger.warn(
            `No se pudo crear aviso de sobreestadía: ${(err as Error)?.message}`,
          );
        }
      }
    }
    return result;
  }

  /** Owner(s) con cuenta de sistema, deduplicados por id de usuario. */
  private async resolveOwners(): Promise<{ id: string }[]> {
    if (!this.users) return [];
    const map = new Map<string, { id: string }>();
    for (const email of ownerEmails()) {
      try {
        const u = await this.users.findOneByEmail(email);
        if (u) map.set(u.id, u);
      } catch {
        /* best-effort */
      }
    }
    return [...map.values()];
  }

  private fmtMins(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
}
