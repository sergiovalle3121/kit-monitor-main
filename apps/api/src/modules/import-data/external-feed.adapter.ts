import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import type { ImportTarget } from './import-logic';

/**
 * Skeleton for external master-data feeds (SAP IDoc / OData / REST API). The
 * interface is READY so a real connector is a drop-in follow-up; today it is not
 * configured and reports so clearly (we never import garbage silently).
 *
 * A real adapter would: connect to the source (e.g. SAP IDoc MATMAS / BOMMAT /
 * ROUTING, or an OData service), pull records for the target, and normalize them
 * into the same `Record<string, any>[]` row shape the CSV/Excel/staging paths use
 * — so the rest of the pipeline (map → validate → preview → commit) is identical.
 */
export interface ExternalFeedConfig {
  endpoint?: string;
  credentialsRef?: string;
  [key: string]: any;
}

export interface ExternalFeedAdapter {
  /** True when a real connector is wired and configured. */
  isConfigured(): boolean;
  /** Pull rows for a target from the external system (IDoc/API). */
  fetchRows(target: ImportTarget, config?: ExternalFeedConfig): Promise<Record<string, any>[]>;
}

@Injectable()
export class NotConfiguredFeedAdapter implements ExternalFeedAdapter {
  private readonly logger = new Logger(NotConfiguredFeedAdapter.name);

  isConfigured(): boolean {
    return false;
  }

  async fetchRows(
    target: ImportTarget,
    _config?: ExternalFeedConfig,
  ): Promise<Record<string, any>[]> {
    this.logger.warn(`IDoc/API feed requested for ${target} but no connector is configured.`);
    throw new NotImplementedException(
      'El feed IDoc/API aún no está configurado (gancho listo, conexión real es follow-up). ' +
        'Usa CSV/Excel o staging SQL por ahora.',
    );
  }
}
