import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type TestStationType = 'ICT' | 'FCT' | 'AOI' | 'FINAL' | 'OTHER';
export type TestResult = 'PASS' | 'FAIL';

/**
 * An immutable test-execution record for one serial at one station (Test
 * Engineering / yields). Folio from the central numbering service (docType
 * TEST_RECORD → TST-…). Fully additive table. Multiple records per serial model
 * retests; the first record per serial backs First-Pass Yield.
 */
@Entity('test_records')
@Index('idx_testrec_scope_result', ['tenant_id', 'plant_id', 'result'])
@Index('idx_testrec_serial', ['tenant_id', 'serialNumber'])
export class TestRecord extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  folio: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80, name: 'serial_number' })
  serialNumber: string;

  @Column({ type: 'varchar', length: 12, default: 'FINAL' })
  station: TestStationType;

  @Column({ type: 'varchar', length: 4, default: 'PASS' })
  result: TestResult;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Index()
  @Column({ type: 'varchar', length: 48, nullable: true, name: 'failure_code' })
  failureCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'failure_description' })
  failureDescription: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  operator: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'tested_at' })
  testedAt: Date | null;
}
