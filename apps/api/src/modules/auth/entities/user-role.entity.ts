import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from './role.entity';
import { Tenant } from './tenant.entity';
import { Plant } from './plant.entity';

/**
 * UserRoleAssignment entity - represents the assignment of a role to a user.
 * Each assignment is scoped to a tenant and optionally to a specific plant.
 * A null plantId means the role applies globally within the tenant.
 */
@Entity('user_roles')
@Unique(['userId', 'roleId', 'tenantId', 'plantId'])
@Index(['userId'])
@Index(['roleId'])
@Index(['tenantId'])
export class UserRoleAssignment extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId: string;

  @ManyToOne(() => Role, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid', name: 'plant_id', nullable: true })
  plantId: string | null;

  @ManyToOne(() => Plant, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'plant_id' })
  plant: Plant | null;
}
