import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnterpriseBuilding } from './enterprise-building.entity';

export type EnterpriseWarehouseType =
  | 'central'
  | 'building'
  | 'subwarehouse'
  | 'pou'
  | 'quarantine'
  | 'transit';
export type EnterpriseWarehouseStatus = 'active' | 'maintenance' | 'offline';

@Entity('enterprise_warehouses')
export class EnterpriseWarehouse {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @ManyToOne(() => EnterpriseBuilding, (building) => building.warehouses, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'building_id' })
  building?: EnterpriseBuilding | null;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 24 })
  type: EnterpriseWarehouseType;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: EnterpriseWarehouseStatus;

  @Column({ type: 'int', default: 0 })
  locationCount: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
