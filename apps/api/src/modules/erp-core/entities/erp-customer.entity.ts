import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { money } from './money';

export type CustomerStatus = 'active' | 'inactive';

/** Sales customer master (XD01) — the billing/shipping counterparty for SD. */
@Entity('erp_customers')
export class ErpCustomer {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  taxId: string | null;

  @Column({ type: 'int', default: 30 })
  paymentTermsDays: number;

  @Column(money())
  creditLimit: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  billingAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  shippingAddress: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  contactEmail: string | null;

  @Column({ type: 'varchar', length: 12, default: 'active' })
  status: CustomerStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
