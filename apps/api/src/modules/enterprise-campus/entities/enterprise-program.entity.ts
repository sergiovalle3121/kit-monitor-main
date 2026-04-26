import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnterpriseCustomer } from './enterprise-customer.entity';
import { EnterpriseBuilding } from './enterprise-building.entity';

export type EnterpriseProgramStatus =
  | 'active'
  | 'npi'
  | 'ramping'
  | 'end_of_life'
  | 'on_hold';

@Entity('enterprise_programs')
export class EnterpriseProgram {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @ManyToOne(() => EnterpriseCustomer, (customer) => customer.programs, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: EnterpriseCustomer;

  @ManyToOne(
    () => EnterpriseBuilding,
    (building) => building.dedicatedPrograms,
    { nullable: true, onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'dedicated_building_id' })
  dedicatedBuilding?: EnterpriseBuilding | null;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: EnterpriseProgramStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  primaryModelPrefix?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
