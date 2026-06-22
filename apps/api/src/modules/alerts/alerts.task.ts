import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertsService } from './alerts.service';

/**
 * Disparador programado del motor de alertas. SOLO llama a
 * `scanReadinessAndNotify()`; toda la lógica (y los tests) viven en el servicio.
 *
 * Frecuencia configurable por env (`ALERTS_READINESS_CRON`) con un default
 * conservador de cada 6 h. Se puede apagar con `ALERTS_READINESS_ENABLED=false`.
 * El handler envuelve el escaneo en try/catch, así que una corrida sin DB (o
 * cualquier fallo) no-opera limpio sin tumbar el proceso.
 */
@Injectable()
export class AlertsTask {
  private readonly logger = new Logger(AlertsTask.name);

  constructor(private readonly alerts: AlertsService) {}

  @Cron(process.env.ALERTS_READINESS_CRON || '0 */6 * * *', {
    name: 'alerts:readiness',
  })
  async handleReadinessScan(): Promise<void> {
    if (process.env.ALERTS_READINESS_ENABLED === 'false') return;
    try {
      const { scanned, notified } = await this.alerts.scanReadinessAndNotify();
      this.logger.log(
        `Readiness scan: ${scanned} plan(es) activo(s), ${notified} alerta(s) al buzón.`,
      );
    } catch (err) {
      this.logger.error(
        `Readiness scan falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
