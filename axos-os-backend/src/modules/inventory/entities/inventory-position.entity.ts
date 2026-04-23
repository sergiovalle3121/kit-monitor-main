import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, Unique, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { MaterialMaster } from './material-master.entity';
import { EnterpriseWarehouse } from '../../enterprise-campus/entities/enterprise-warehouse.entity';

@Entity('inventory_positions')
@Unique(['material', 'warehouse', 'location', 'programId'])
export class InventoryPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MaterialMaster)
  @JoinColumn({ name: 'part_number' })
  material: MaterialMaster;

  @Column({ name: 'part_number' })
  partNumber: string;

  @ManyToOne(() => EnterpriseWarehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: EnterpriseWarehouse;

  @Column({ name: 'warehouse_id' })
  warehouseId: string;

  @Column({ type: 'varchar', length: 100, default: 'BULK' })
  location: string; // Zone/Rack/Bin

  @Column({ type: 'varchar', length: 100, nullable: true })
  programId?: string; // Multi-program isolation

  @Column({ type: 'float', default: 0 })
  onHand: number;

  @Column({ type: 'float', default: 0 })
  allocated: number; // Reserved for specific kits/WOs

  @Column({ type: 'float', default: 0 })
  inTransit: number;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'available',
  })
  @Index()
  holdStatus: 'available' | 'hold' | 'quarantine' | 'expired' | 'pending_iqc' | 'pending_oqc' | 'staged_for_shipping' | 'shipped';

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual property for convenience
  get available(): number {
    return this.onHand - this.allocated;
  }
}
