import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';
import type { FaiMeasurement, FaiResult } from '../fai-state';

/**
 * First Article Inspection (FAI / primera pieza) — block E. Captures the
 * pass/fail of the first built unit of a WO, its dimensional/functional
 * measurements and the inspector who signed. On PASS the service flips the WO's
 * `faiApproved` flag (production-plan.setFaiApproved) so it may run; a WO whose
 * `faiRequired` is set will not run until a passing FAI exists.
 *
 * Table prefixed `sf_` to avoid colliding with the legacy quality inspection
 * tables. Decoupled from the WO by a denormalized woId/woFolio/model string.
 */
@Entity('sf_fai')
@Index('idx_sf_fai_scope_result', ['tenant_id', 'plant_id', 'result'])
@Index('idx_sf_fai_wo', ['woId', 'result'])
export class SfFai extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  /** The work order this first piece belongs to (denormalized UUID). */
  @Index()
  @Column({ type: 'varchar', length: 36, name: 'wo_id' })
  woId: string;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 16, default: 'A' })
  revision: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  line: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  station: string | null;

  /** Serial of the inspected first piece (genealogy link), when serialized. */
  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  serial: string | null;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  result: FaiResult;

  /** Captured measurements (characteristic, nominal, lsl/usl, actual, pass). */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  measurements: FaiMeasurement[] | null;

  /** Inspector that signed the disposition (workflow accountability). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  inspector: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'inspected_at' })
  inspectedAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'raised_by' })
  raisedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'raised_at' })
  raisedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
