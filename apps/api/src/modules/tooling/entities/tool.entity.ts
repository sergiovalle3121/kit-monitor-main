import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { ToolStatus, ToolType } from '../tool-life';

/**
 * A tooling asset — mold / fixture / stencil / gauge (NPI / Process). Folio from
 * the central numbering service (docType TOOL → TL-…). Fully additive table
 * `tooling_assets`. Life percentage / remaining shots are derived at read time.
 */
@Entity('tooling_assets')
@Index('idx_tool_scope_status', ['tenant_id', 'plant_id', 'status'])
export class Tool extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 12, default: 'MOLD' })
  type: ToolType;

  @Column({ type: 'int', default: 1 })
  cavities: number;

  @Column({ type: 'int', default: 0, name: 'life_shots' })
  lifeShots: number;

  @Column({ type: 'int', default: 0, name: 'shots_used' })
  shotsUsed: number;

  @Column({ type: 'varchar', length: 12, default: 'AVAILABLE' })
  status: ToolStatus;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  // ── Calibración / PM (IATF) — aditivo y nullable. Los herramentales previos
  // quedan en null y se muestran como "sin calibración registrada"; no hay
  // migración destructiva (synchronize crea las columnas vacías). ──────────────
  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'last_calibration_date' })
  lastCalibrationDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'next_calibration_date' })
  nextCalibrationDate: Date | null;

  /** Intervalo de calibración en días; deriva la próxima fecha cuando no se da explícita. */
  @Column({ type: 'int', nullable: true, name: 'calibration_interval_days' })
  calibrationIntervalDays: number | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'last_pm_date' })
  lastPmDate: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'next_pm_date' })
  nextPmDate: Date | null;
}
