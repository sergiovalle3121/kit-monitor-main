import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Plan } from '../plans/entities/plan.entity';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { BomHeader } from '../bom/entities/bom-header.entity';
import { MaterialRequest } from '../material-requests/entities/material-request.entity';
import { WorkOrderExecution } from '../mes-execution/entities/work-order-execution.entity';
import { Kit } from '../kits/entities/kit.entity';
import { Shipment } from '../shipping/entities/shipment.entity';
import { NCR } from '../ncr/entities/ncr.entity';
import { CostItem } from '../cost-rollup/entities/cost-item.entity';
import { CancellationRequest } from '../cancellation-requests/entities/cancellation-request.entity';
import { ProductionWip } from '../production-runtime/entities/production-wip.entity';

/**
 * Mantenimiento de datos. Permite al admin dejar la operación VACÍA, borrando los
 * datos transaccionales y el master de ingeniería que pudieran haber quedado de
 * seeds/imports antiguos (planes, BOM, materiales, kits, WO en ejecución,
 * solicitudes, envíos, NCR, costos…). CASCADE limpia los dependientes.
 *
 * PRESERVA a propósito: usuarios/roles, políticas de gobierno, cuentas contables,
 * branding/tenant, documentos de Office, dimensiones de la organización
 * (edificios/clientes/proyectos, que el admin administra aparte) y el historial de
 * auditoría/ledger.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resetOperationalData(): Promise<{
    ok: true;
    cleared: string[];
    method: string;
  }> {
    // Tablas "raíz" de la operación. CASCADE arrastra a sus dependientes
    // (kit_materials, pick lists, pasos de ejecución, bom_components, posiciones
    // de inventario, plan links, incidencias, inspecciones, items de envío…).
    const roots = [
      Plan,
      MaterialMaster,
      BomHeader,
      MaterialRequest,
      WorkOrderExecution,
      Kit,
      Shipment,
      NCR,
      CostItem,
      CancellationRequest,
      ProductionWip,
    ];
    const tables = Array.from(
      new Set(roots.map((e) => this.dataSource.getMetadata(e).tableName)),
    );
    const type = this.dataSource.options.type;

    if (type === 'postgres') {
      const quoted = tables.map((t) => `"${t}"`).join(', ');
      try {
        await this.dataSource.query(
          `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
        );
      } catch (err) {
        // Si una tabla aún no existe o el TRUNCATE conjunto falla, vamos una a una.
        this.logger.warn(
          `TRUNCATE conjunto falló (${(err as Error).message}); reintentando por tabla.`,
        );
        for (const t of tables) {
          try {
            await this.dataSource.query(
              `TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`,
            );
          } catch (e) {
            this.logger.warn(`TRUNCATE "${t}" omitido: ${(e as Error).message}`);
          }
        }
      }
    } else {
      // SQLite / otros: borrado por tabla con FKs desactivadas (best-effort).
      await this.dataSource.query('PRAGMA foreign_keys = OFF').catch(() => undefined);
      for (const t of tables) {
        try {
          await this.dataSource.query(`DELETE FROM "${t}"`);
        } catch (e) {
          this.logger.warn(`DELETE "${t}" omitido: ${(e as Error).message}`);
        }
      }
      await this.dataSource.query('PRAGMA foreign_keys = ON').catch(() => undefined);
    }

    this.logger.warn(
      `Datos de operación reiniciados por el admin. Raíces: ${tables.join(', ')} (+ dependientes por CASCADE).`,
    );
    return {
      ok: true,
      cleared: tables,
      method: type === 'postgres' ? 'truncate_cascade' : 'delete',
    };
  }
}
