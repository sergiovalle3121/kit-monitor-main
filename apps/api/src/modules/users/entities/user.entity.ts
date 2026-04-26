import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../auth/entities/base.entity';
import { Tenant } from '../../auth/entities/tenant.entity';
import { UserRoleAssignment } from '../../auth/entities/user-role.entity';

/**
 * User entity - represents a user in the system.
 * Each user belongs to a tenant and can have multiple roles assigned.
 * Unified version for the AXOS OS RBAC system.
 */
@Entity('users')
@Index(['tenantId'])
@Index(['email', 'tenantId'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { eager: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  @Column({ type: 'varchar', length: 255, select: false, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date | null;

  /**
   * Roles assigned to this user.
   * Each role assignment includes tenant and optional plant scope.
   */
  @OneToMany(() => UserRoleAssignment, (userRole) => userRole.user)
  userRoles: UserRoleAssignment[];

  // Compatibility fields for legacy code (TODO: remove once all modules are updated)
  @Column({ type: 'jsonb', nullable: true })
  scopes: any;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];
}
