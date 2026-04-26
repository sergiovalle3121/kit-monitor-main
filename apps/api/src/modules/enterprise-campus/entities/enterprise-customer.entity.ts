import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnterpriseProgram } from './enterprise-program.entity';

export type EnterpriseCustomerStatus = 'active' | 'onboarding' | 'inactive';

@Entity('enterprise_customers')
export class EnterpriseCustomer {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  industry?: string | null;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: EnterpriseCustomerStatus;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any> | null;

  @OneToMany(() => EnterpriseProgram, (program) => program.customer)
  programs: EnterpriseProgram[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
