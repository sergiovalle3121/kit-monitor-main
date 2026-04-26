import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { UserRoleAssignment } from './user-role.entity';

/**
 * User entity - represents a user in the system.
 * Each user belongs to a tenant and can have multiple roles assigned.
 */
@Entity('users_auth')
@Index(['tenant_id'])
@Index(['email', 'tenant_id'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { eager: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date | null;

  /**
   * Roles assigned to this user.
   * Each role assignment includes tenant and optional plant scope.
   */
  @OneToMany(() => UserRoleAssignment, (userRole) => userRole.user)
  userRoles: UserRoleAssignment[];
}
