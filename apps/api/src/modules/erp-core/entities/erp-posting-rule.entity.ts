import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Account-determination rule: maps a business event to the GL accounts that get
 * debited / credited. Seeded with sensible defaults and editable, so postings
 * work out of the box but can be reconfigured without code changes.
 */
@Entity('erp_posting_rules')
export class ErpPostingRule {
  /** Event key, e.g. GOODS_RECEIPT, GOODS_ISSUE, AP_INVOICE, SALES_INVOICE, COGS, AR_PAYMENT, AP_PAYMENT. */
  @PrimaryColumn({ type: 'varchar', length: 48 })
  event: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 160 })
  description: string;

  @Column({ type: 'varchar', length: 24 })
  debitCode: string;

  @Column({ type: 'varchar', length: 24 })
  creditCode: string;

  /** Optional tax account, used by invoice events. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  taxCode: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
