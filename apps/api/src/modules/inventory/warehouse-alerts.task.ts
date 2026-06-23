import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WarehouseAlertsService } from './warehouse-alerts.service';

/**
 * Disparador programado de las alertas del Pull Monitor (SLA roto → supervisor;
 * pull urgente → handler). La lógica vive en `WarehouseAlertsService` (y sus
 * tests). Frecuencia configurable por env (`WAREHOUSE_PULL_SLA_CRON`, default
 * cada 10 min); se apaga con `WAREHOUSE_PULL_SLA_ENABLED=false`. El handler
 * envuelve el escaneo en try/catch: una corrida sin DB (o cualquier fallo)
 * no-opera limpio sin tumbar el proceso.
 */
@Injectable()
export class WarehouseAlertsTask {
  private readonly logger = new Logger(WarehouseAlertsTask.name);

  constructor(private readonly alerts: WarehouseAlertsService) {}

  @Cron(process.env.WAREHOUSE_PULL_SLA_CRON || '*/10 * * * *', {
    name: 'warehouse:pull-sla',
  })
  async handlePullSlaScan(): Promise<void> {
    if (process.env.WAREHOUSE_PULL_SLA_ENABLED === 'false') return;
    try {
      const r = await this.alerts.scanPullSlaAndNotify();
      this.logger.log(
        `Pull SLA scan: ${r.scanned} abierto(s), ${r.breached} con SLA roto, ${r.urgent} urgente(s), ${r.notified} aviso(s), ${r.unresolved} sin destinatario.`,
      );
    } catch (err) {
      this.logger.error(`Pull SLA scan falló: ${(err as Error)?.message}`, (err as Error)?.stack);
    }
  }
}
