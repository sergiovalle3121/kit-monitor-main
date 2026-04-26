import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type InventoryTransactionType =
  | 'RECEIVE' // Inbound from supplier
  | 'TRANSFER' // WH to WH
  | 'PUTAWAY' // Receiving to Bin
  | 'ISSUE' // WH to Production
  | 'RETURN' // Production to WH
  | 'ADJUST' // Cycle count / Correction
  | 'RESUPPLY' // Movement triggered by Resupply module
  | 'CONSUME' // Backflush / Actual usage
  | 'HOLD' // Lock material
  | 'RELEASE' // Unlock material
  | 'SCRAP'; // Disposal

@Entity('inventory_movements')
@Index(['tenant_id', 'partNumber'])
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  // Multi-tenant isolation — nullable during migration phase.
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    name: 'organization_id',
  })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'plant_id' })
  plant_id: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  partNumber: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  fromWarehouseId?: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  toWarehouseId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fromLocation?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  toLocation?: string;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'varchar', length: 32 })
  type: InventoryTransactionType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceType?: string; // KIT, WO, PO, RMA

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId?: string;

  @Column({ type: 'varchar', length: 120 })
  actorName: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt: Date;
}
