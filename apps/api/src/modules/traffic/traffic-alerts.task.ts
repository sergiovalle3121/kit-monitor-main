import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrafficAlertsService } from './traffic-alerts.service';

/**
 * Disparador programado de las alertas de patio (sobreestadía de andenes). La
 * lógica vive en `TrafficAlertsService` (y sus tests). Frecuencia configurable por
 * env (`TRAFFIC_DOCK_OVERSTAY_CRON`, default cada 30 min); se apaga con
 * `TRAFFIC_DOCK_OVERSTAY_ENABLED=false`. El handler envuelve el escaneo en
 * try/catch, así que una corrida sin DB (o cualquier fallo) no-opera limpio sin
 * tumbar el proceso.
 */
@Injectable()
export class TrafficAlertsTask {
  private readonly logger = new Logger(TrafficAlertsTask.name);

  constructor(private readonly alerts: TrafficAlertsService) {}

  @Cron(process.env.TRAFFIC_DOCK_OVERSTAY_CRON || '*/30 * * * *', {
    name: 'traffic:dock-overstay',
  })
  async handleDockOverstayScan(): Promise<void> {
    if (process.env.TRAFFIC_DOCK_OVERSTAY_ENABLED === 'false') return;
    try {
      const r = await this.alerts.scanDockOverstayAndNotify();
      this.logger.log(
        `Dock overstay scan: ${r.occupied} ocupado(s), ${r.overstay} con sobreestadía, ${r.notified} aviso(s), ${r.unresolved} sin destinatario.`,
      );
    } catch (err) {
      this.logger.error(
        `Dock overstay scan falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
