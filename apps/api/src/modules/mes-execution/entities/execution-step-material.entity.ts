import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Live consumption tracking for one material at one station of an execution.
 * Snapshotted from ProcessStepMaterial at open time, linked back to the kit's
 * PickList row (`kitMaterialId`) which is the authoritative source decremented
 * on backflush.
 */
@Entity('mes_execution_step_materials')
@Index(['executionStepId', 'partNumber'], { unique: true })
export class ExecutionStepMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'int' })
  @Index()
  executionStepId: number;

  @Column({ type: 'int' })
  @Index()
  executionId: number;

  @Column({ type: 'varchar', length: 120 })
  partNumber: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'EA' })
  unit: string;

  @Column({ type: 'float', default: 1 })
  qtyPerUnit: number;

  /** FK to kit_materials.id — the PickList row decremented on backflush. */
  @Column({ type: 'int', nullable: true })
  kitMaterialId: number | null;

  @Column({ type: 'float', default: 0 })
  plannedQty: number;

  @Column({ type: 'float', default: 0 })
  consumedQty: number;

  @Column({ type: 'float', default: 0 })
  scrapQty: number;

  /** What is physically available at the line for this part (delivered − consumed). */
  @Column({ type: 'float', default: 0 })
  availableQty: number;

  @Column({ type: 'float', default: 0 })
  lowStockThreshold: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
