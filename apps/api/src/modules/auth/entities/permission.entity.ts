import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Permission entity - represents a specific permission in the system.
 * Permissions are defined by resource and action pairs (e.g., 'finance:read').
 */
@Entity('permissions')
@Unique(['resource', 'action'])
export class Permission extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  resource: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
