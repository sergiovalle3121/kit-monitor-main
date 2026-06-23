import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PeopleAlertsService } from './people-alerts.service';

/**
 * Disparador programado de las alertas de recertificación. Toda la lógica vive
 * en `PeopleAlertsService` (y sus tests). Frecuencia configurable por env
 * (`PEOPLE_RECERT_CRON`, default diario 07:00); se apaga con
 * `PEOPLE_RECERT_ENABLED=false`. El handler envuelve el escaneo en try/catch, así
 * que una corrida sin DB (o cualquier fallo) no-opera limpio sin tumbar el proceso.
 */
@Injectable()
export class PeopleAlertsTask {
  private readonly logger = new Logger(PeopleAlertsTask.name);

  constructor(private readonly alerts: PeopleAlertsService) {}

  @Cron(process.env.PEOPLE_RECERT_CRON || '0 7 * * *', { name: 'people:recert' })
  async handleRecertScan(): Promise<void> {
    if (process.env.PEOPLE_RECERT_ENABLED === 'false') return;
    try {
      const r = await this.alerts.scanRecertAndNotify();
      this.logger.log(
        `Recert scan: ${r.scanned} cert(s), ${r.expiring} por vencer, ${r.expired} vencida(s), ${r.notified} aviso(s), ${r.unresolved} sin destinatario.`,
      );
    } catch (err) {
      this.logger.error(
        `Recert scan falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
