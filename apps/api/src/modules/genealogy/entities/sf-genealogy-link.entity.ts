import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type GenealogyLinkSource =
  | 'MANUAL'
  | 'OPERATOR_TERMINAL'
  | 'MES'
  | 'EXTERNAL';

/**
 * Additive cradle-to-grave genealogy index (the table the task calls
 * `sf_genealogy_index`). One row = "built serial X consumed `qty` of part P,
 * lot/reel L/R, at `station` by `operator` at `consumedAt`".
 *
 * It is the FORWARD-capture / enrichment store: the shop-floor consumption ledger
 * (`sf_consumption_events`) records serial+part+station+operator+timestamp but NOT
 * the lot/reel of the consumed material — this table closes that gap. It is
 * populated by event (the `recordLink` hook the MES confirmation path calls when
 * a reel/lot is scanned, never touching the source tables) and read by the
 * as-built / where-used queries, which UNION it with the live consumption ledger.
 * Fully additive, prefixed table, all columns
 * nullable/defaulted; idempotent via `idempotency_key`.
 */
@Entity('sf_genealogy_index')
@Index('idx_sf_geni_scope', ['tenant_id', 'plant_id'])
@Index('idx_sf_geni_part_lot', ['part', 'lot'])
export class SfGenealogyLink extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Dedup key so re-recording the same consumption never double-counts. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160, name: 'idempotency_key' })
  idempotencyKey: string;

  /** The serial of the unit being built (the parent in the genealogy tree). */
  @Index()
  @Column({ type: 'varchar', length: 80, name: 'built_serial' })
  builtSerial: string;

  /** Optional parent serial when this built unit is itself fed into an assembly. */
  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true, name: 'parent_serial' })
  parentSerial: string | null;

  /** Consumed part number (NP). */
  @Index()
  @Column({ type: 'varchar', length: 64 })
  part: string;

  /** Supplier lot of the consumed material. */
  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  lot: string | null;

  /** Physical reel / feeder reel id of the consumed material. */
  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  reel: string | null;

  @Column({ type: 'float', default: 0 })
  qty: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'wo_id' })
  woId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'wo_folio' })
  woFolio: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  station: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'operator_email' })
  operatorEmail: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'consumed_at' })
  consumedAt: Date | null;

  @Column({ type: 'varchar', length: 24, default: 'MANUAL' })
  source: GenealogyLinkSource;

  /** Id of the originating consumption event, when derived/linked from one. */
  @Column({ type: 'varchar', length: 80, nullable: true, name: 'source_event_id' })
  sourceEventId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'program_id' })
  programId: string | null;
}
