import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import { money } from './money';

export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'card';

/** Settlement of an AR/AP invoice (FIN02). Posts Bank <-> AR/AP to the GL. */
@Entity('erp_payments')
export class ErpPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 32 })
  @Index({ unique: true })
  paymentNumber: string;

  @Column({ type: 'int' })
  @Index()
  invoiceId: number;

  @Column({ type: 'varchar', length: 4 })
  kind: 'AR' | 'AP';

  @Column({ type: DATE_COLUMN_TYPE })
  date: Date;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column(money())
  amount: number;

  @Column({ type: 'varchar', length: 16, default: 'transfer' })
  method: PaymentMethod;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @Column({ type: 'int', nullable: true })
  journalEntryId: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
