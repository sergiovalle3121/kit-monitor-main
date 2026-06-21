import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type {
  UnitFlowDestination,
  UnitFlowStage,
  UnitTestResult,
} from '../unit-flow-stage';

/**
 * One serialized unit's journey across the Assembly → Pruebas → Empaque weave.
 *
 * Fully additive bridge table: the MES still completes by quantity and the
 * `testing` module still records results exactly as before. This row only
 * appears once a *serial* is scanned at the final assembly station, and it is
 * the single thread that ties a WO to its test result and final destination.
 * One live row per serial (per tenant); routing updates it in place.
 */
@Entity('test_flow_units')
@Index('idx_test_flow_scope_stage', ['tenant_id', 'plant_id', 'stage'])
@Index('idx_test_flow_serial', ['tenant_id', 'serialNumber'])
export class UnitFlow extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 80, name: 'serial_number' })
  serialNumber: string;

  @Column({ type: 'varchar', length: 24, default: 'AWAITING_TEST' })
  stage: UnitFlowStage;

  // ── Assembly provenance (who built it) ──────────────────────────────────────
  @Index()
  @Column({ type: 'varchar', length: 120, nullable: true, name: 'work_order' })
  workOrder: string | null;

  @Column({ type: 'int', nullable: true, name: 'execution_id' })
  executionId: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
    name: 'assembly_station',
  })
  assemblyStation: string | null;

  // ── Test outcome (what Pruebas decided) ─────────────────────────────────────
  @Column({ type: 'varchar', length: 4, nullable: true, name: 'test_result' })
  testResult: UnitTestResult | null;

  @Column({ type: 'varchar', length: 48, nullable: true, name: 'failure_code' })
  failureCode: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    name: 'test_record_id',
  })
  testRecordId: string | null;

  // ── Destination (where it goes next) ────────────────────────────────────────
  @Column({ type: 'varchar', length: 16, nullable: true })
  destination: UnitFlowDestination | null;

  /** Floor-quality hold that owns the disposition when the unit failed. */
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'hold_id' })
  holdId: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'enqueued_at' })
  enqueuedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'tested_at' })
  testedAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'routed_at' })
  routedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
