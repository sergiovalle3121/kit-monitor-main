import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MaintenanceService } from './maintenance.service';

/**
 * Disparador programado del aviso de PM vencido → buzón del planeador. SOLO llama
 * a `scanPmDueAndNotify()`; la lógica (y los tests) viven en el servicio.
 *
 * OPT-IN por diseño: desactivado salvo `MAINTENANCE_PM_ALERTS_ENABLED=true`. El
 * scan corre sin contexto de request (tenant nulo), igual que el motor de alertas
 * de readiness; el fan-out por tenant es un follow-up documentado, así que se deja
 * apagado hasta verificarlo en el entorno. Frecuencia configurable por env
 * (`MAINTENANCE_PM_CRON`, default diario 7am). El handler envuelve el escaneo en
 * try/catch: un fallo (o correr sin DB) no-opera limpio sin tumbar el proceso.
 */
@Injectable()
export class MaintenancePmTask {
  private readonly logger = new Logger(MaintenancePmTask.name);

  constructor(private readonly maintenance: MaintenanceService) {}

  @Cron(process.env.MAINTENANCE_PM_CRON || '0 7 * * *', {
    name: 'maintenance:pm-due',
  })
  async handlePmDueScan(): Promise<void> {
    if (process.env.MAINTENANCE_PM_ALERTS_ENABLED !== 'true') return;
    try {
      const { scanned, notified } = await this.maintenance.scanPmDueAndNotify();
      this.logger.log(
        `PM due scan: ${scanned} plan(es) activo(s), ${notified} aviso(s) al buzón.`,
      );
    } catch (err) {
      this.logger.error(
        `PM due scan falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
