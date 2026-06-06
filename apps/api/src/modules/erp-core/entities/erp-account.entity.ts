import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense';
export type NormalBalance = 'debit' | 'credit';

/**
 * Chart of Accounts master (FIN). Replaces the hardcoded industrial account
 * enums with a real, postable account catalog. Seeded with a default Axos CoA
 * that includes the legacy industrial inventory codes (1410/1420/1430...).
 */
@Entity('erp_accounts')
export class ErpAccount {
  @PrimaryColumn({ type: 'varchar', length: 24 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  @Index()
  type: AccountType;

  @Column({ type: 'varchar', length: 8 })
  normalBalance: NormalBalance;

  @Column({ type: 'varchar', length: 24, nullable: true })
  parentCode: string | null;

  @Column({ type: 'boolean', default: true })
  isPostable: boolean;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
