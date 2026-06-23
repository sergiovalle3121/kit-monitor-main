import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ToolingService } from './tooling.service';

/**
 * Disparador programado de las alertas de herramentales (EOL + calibración).
 * SOLO llama a `scanAlerts()`; la lógica (y los tests) viven en el servicio.
 *
 * Reusa el `ScheduleModule.forRoot()` global ya existente en AppModule (mismo
 * patrón que AlertsTask) — no aporta infraestructura nueva. Frecuencia y on/off
 * por env (`TOOLING_ALERTS_CRON`, default cada 6 h; `TOOLING_ALERTS_ENABLED`).
 *
 * Nota de tenancy (igual que el motor de alertas de readiness): corre FUERA de un
 * request, sin contexto de tenant, por lo que el barrido programado cubre el
 * scope nulo de tenant. El disparo INMEDIATO de EOL (en `recordUsage`/`checkin`)
 * y el endpoint `POST /tooling/alerts/scan` sí corren en-request con el tenant
 * correcto. El fan-out multi-tenant del cron es un follow-up acotado.
 */
@Injectable()
export class ToolingAlertsTask {
  private readonly logger = new Logger(ToolingAlertsTask.name);

  constructor(private readonly tooling: ToolingService) {}

  @Cron(process.env.TOOLING_ALERTS_CRON || '0 */6 * * *', {
    name: 'tooling:alerts',
  })
  async handleScan(): Promise<void> {
    if (process.env.TOOLING_ALERTS_ENABLED === 'false') return;
    try {
      const { scanned, eolNotified, calNotified } = await this.tooling.scanAlerts();
      this.logger.log(
        `Tooling alerts scan: ${scanned} herramental(es), ${eolNotified} EOL + ${calNotified} calibración al buzón.`,
      );
    } catch (err) {
      this.logger.error(
        `Tooling alerts scan falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
