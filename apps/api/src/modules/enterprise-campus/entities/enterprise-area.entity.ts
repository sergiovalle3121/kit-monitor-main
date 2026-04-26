import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnterpriseBuilding } from './enterprise-building.entity';
import { EnterpriseLine } from './enterprise-line.entity';

export type EnterpriseAreaType =
  | 'SMT'
  | 'PCBA'
  | 'Assembly'
  | 'Test'
  | 'Shipping'
  | 'Storage'
  | 'Other';
export type EnterpriseAreaStatus = 'active' | 'maintenance' | 'inactive';

@Entity('enterprise_areas')
export class EnterpriseArea {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @ManyToOne(() => EnterpriseBuilding, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'building_id' })
  building: EnterpriseBuilding;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 24 })
  type: EnterpriseAreaType;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: EnterpriseAreaStatus;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => EnterpriseLine, (line) => line.area)
  lines: EnterpriseLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
