import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * Préstamo de un herramental a una orden de trabajo (check-out / check-in).
 * Tabla aditiva `tooling_checkouts`. Un registro ABIERTO (checked_in_at NULL)
 * significa que el tool está prestado AHORA mismo — el cribbero sabe en todo
 * momento DÓNDE está cada molde y a qué WO.
 *
 * Referencia la WO por id y folio/modelo DENORMALIZADOS: NO acopla la entidad
 * SfWorkOrder (solo se lee, best-effort, al prestar para enriquecer estos
 * campos). Trazabilidad IATF: quién prestó/recibió, cuándo, a qué WO y cuántos
 * disparos consumió el préstamo.
 */
@Entity('tooling_checkouts')
@Index('idx_tool_checkout_open', ['tenant_id', 'plant_id', 'toolId', 'checkedInAt'])
export class ToolCheckout extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'tool_id' })
  toolId: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'work_order_id' })
  workOrderId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'work_order_folio' })
  workOrderFolio: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'work_order_model' })
  workOrderModel: string | null;

  @Column({ type: DATE_COLUMN_TYPE, name: 'checked_out_at' })
  checkedOutAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'checked_out_by' })
  checkedOutBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'checked_in_at' })
  checkedInAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'checked_in_by' })
  checkedInBy: string | null;

  /** Disparos acumulados del tool al prestarlo (foto para trazabilidad). */
  @Column({ type: 'int', default: 0, name: 'shots_at_checkout' })
  shotsAtCheckout: number;

  /** Disparos acumulados del tool al recibirlo. */
  @Column({ type: 'int', nullable: true, name: 'shots_at_checkin' })
  shotsAtCheckin: number | null;

  /** Disparos consumidos DURANTE el préstamo (reportados o derivados del delta). */
  @Column({ type: 'int', nullable: true, name: 'shots_during' })
  shotsDuring: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;
}
