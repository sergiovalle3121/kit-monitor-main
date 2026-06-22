import {
  Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * A person at a supplier — sales, quality (their SQE counterpart), logistics,
 * engineering. Additive table `supplier_contacts`. References the supplier by
 * its integer id to match the (non-tenant-scoped) Supplier master.
 */
@Entity('supplier_contacts')
export class SupplierContact {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int', name: 'supplier_id' })
  supplierId: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title?: string;

  /** SALES | QUALITY | LOGISTICS | ENGINEERING | FINANCE | EXECUTIVE | OTHER. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  role?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone?: string;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
