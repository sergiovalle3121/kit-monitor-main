import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('material_master')
export class MaterialMaster {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  partNumber: string;

  // Multi-tenant: nullable during migration; each tenant maintains its own catalog.
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'organization_id' })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'EA' })
  uom: string; // Unit of Measure

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'float', default: 0 })
  standardCost: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  abcClass?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
