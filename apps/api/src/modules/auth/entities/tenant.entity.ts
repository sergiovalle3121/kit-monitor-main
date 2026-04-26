import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Tenant entity - represents a multi-tenant organization in AXOS OS.
 * Each tenant has its own isolated data and can have multiple plants.
 */
@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  domain: string;

  @Column({ default: true })
  isActive: boolean;
}
