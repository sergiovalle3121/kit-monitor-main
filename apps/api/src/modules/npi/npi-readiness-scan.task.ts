import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NpiReadinessScanService } from './npi-readiness-scan.service';

/**
 * Scheduled trigger for the NPI readiness watch-dog. Mirrors SuppliersAlertsTask:
 * all logic (and dedupe) lives in the service. Frequency is configurable via
 * `NPI_READINESS_CRON` (default daily 06:00) and can be disabled with
 * `NPI_READINESS_SCAN_ENABLED=false`. Wrapped in try/catch so a run without a DB
 * (or any failure) no-ops cleanly instead of crashing the process.
 */
@Injectable()
export class NpiReadinessScanTask {
  private readonly logger = new Logger(NpiReadinessScanTask.name);

  constructor(private readonly scan: NpiReadinessScanService) {}

  @Cron(process.env.NPI_READINESS_CRON || '0 6 * * *', {
    name: 'npi:readiness',
  })
  async handleScan(): Promise<void> {
    if (process.env.NPI_READINESS_SCAN_ENABLED === 'false') return;
    try {
      const r = await this.scan.scanAndNotify();
      this.logger.log(
        `Escaneo NPI: ${r.scanned} proyecto(s), ${r.captured} snapshot(s), ` +
          `${r.becameReady} listo(s), ${r.stalled} estancado(s), ${r.notified} alerta(s).`,
      );
    } catch (err) {
      this.logger.error(
        `Escaneo NPI falló: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
    }
  }
}
