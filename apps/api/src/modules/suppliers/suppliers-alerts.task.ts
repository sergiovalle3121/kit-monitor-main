import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SuppliersAlertsService } from './suppliers-alerts.service';

/**
 * Scheduled trigger for the supplier watch-dog. Mirrors the planning AlertsTask:
 * all the logic (and its dedupe) lives in the service. Frequency is configurable
 * via `SUPPLIERS_ALERTS_CRON` (default daily 07:00) and can be disabled with
 * `SUPPLIERS_ALERTS_ENABLED=false`. The scan is wrapped in try/catch so a run
 * without a DB (or any failure) no-ops cleanly instead of crashing the process.
 */
@Injectable()
export class SuppliersAlertsTask {
  private readonly logger = new Logger(SuppliersAlertsTask.name);

  constructor(private readonly alerts: SuppliersAlertsService) {}

  @Cron(process.env.SUPPLIERS_ALERTS_CRON || '0 7 * * *', { name: 'suppliers:alerts' })
  async handleScan(): Promise<void> {
    if (process.env.SUPPLIERS_ALERTS_ENABLED === 'false') return;
    try {
      const { scanned, notified } = await this.alerts.scanAndNotify();
      this.logger.log(`Supplier scan: ${scanned} proveedor(es), ${notified} alerta(s) al buzón.`);
    } catch (err) {
      this.logger.error(`Supplier scan falló: ${(err as Error)?.message}`, (err as Error)?.stack);
    }
  }
}
