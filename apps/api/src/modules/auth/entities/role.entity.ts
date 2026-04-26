import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Permission } from './permission.entity';

/**
 * Role entity - represents a system-wide role with associated permissions.
 * Roles are defined at the system level but assigned to users within specific tenants.
 */
@Entity('roles')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Permissions associated with this role.
   * Managed through the RolePermission join table.
   */
  @ManyToMany(() => Permission, { eager: false })
  permissions: Permission[];
}
