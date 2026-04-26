import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnterpriseWarehouse } from './enterprise-warehouse.entity';
import { EnterpriseProgram } from './enterprise-program.entity';

export type EnterpriseBuildingStatus =
  | 'active'
  | 'maintenance'
  | 'idle'
  | 'offline';

@Entity('enterprise_buildings')
export class EnterpriseBuilding {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: EnterpriseBuildingStatus;

  @Column({ type: 'simple-array', default: '' })
  tags: string[];

  @Column({ type: 'simple-array', default: 'A,B,C' })
  activeShifts: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => EnterpriseWarehouse, (warehouse) => warehouse.building)
  warehouses: EnterpriseWarehouse[];

  @OneToMany(() => EnterpriseProgram, (program) => program.dedicatedBuilding)
  dedicatedPrograms: EnterpriseProgram[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
