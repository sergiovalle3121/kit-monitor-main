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

  @Cron(process.env.TRAFFIC_APPT_LATE_CRON || '*/15 * * * *', {
    name: 'traffic:appt-late',
  })
  async handleLateAppointmentScan(): Promise<void> {
    if (process.env.TRAFFIC_APPT_LATE_ENABLED === 'false') return;
    try {
      const r = await this.alerts.scanLateAppointmentsAndNotify();
      this.logger.log(
        `Late appointment scan: ${r.scanned} programada(s), ${r.late} tarde, ${r.notified} aviso(s), ${r.unresolved} sin destinatario.`,
      );
    } catch (err) {
      this.logger.error(
        `Late appointment scan falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }

  @Cron(process.env.TRAFFIC_SHIPMENT_DUE_CRON || '0 * * * *', {
    name: 'traffic:shipment-no-dock',
  })
  async handleShipmentNoDockScan(): Promise<void> {
    if (process.env.TRAFFIC_SHIPMENT_DUE_ENABLED === 'false') return;
    try {
      const r = await this.alerts.scanShipmentsWithoutDockAndNotify();
      this.logger.log(
        `Shipment no-dock scan: ${r.scanned} candidato(s), ${r.flagged} por vencer/sin andén, ${r.notified} aviso(s), ${r.unresolved} sin destinatario.`,
      );
    } catch (err) {
      this.logger.error(
        `Shipment no-dock scan falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
