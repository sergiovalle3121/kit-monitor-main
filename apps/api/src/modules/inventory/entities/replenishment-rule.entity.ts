import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('replenishment_rules')
@Unique(['warehouseId', 'partNumber', 'programId'])
@Index(['tenant_id', 'warehouseId'])
export class ReplenishmentRule {
  @PrimaryGeneratedColumn()
  id: number;

  // Multi-tenant isolation — nullable during migration phase.
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'organization_id' })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'plant_id' })
  plant_id: string | null;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  warehouseId: string; // The "Destination" node that needs replenishment

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  programId?: string;

  @Column({ type: 'float' })
  minStock: number; // Trigger level

  @Column({ type: 'float' })
  maxStock: number; // Target level for full replenishment

  @Column({ type: 'float', default: 0 })
  safetyStock: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  preferredSourceWarehouseId?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  autoCreateTasks: boolean;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'critical';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
