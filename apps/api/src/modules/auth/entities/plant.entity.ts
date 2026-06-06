import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';

/**
 * Plant entity - represents a physical manufacturing plant or facility.
 * Each plant belongs to a tenant and can have multiple users assigned.
 */
@Entity('plants')
export class Plant extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { eager: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ default: true })
  isActive: boolean;
}
