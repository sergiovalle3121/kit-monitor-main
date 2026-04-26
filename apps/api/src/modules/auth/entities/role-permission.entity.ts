import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

/**
 * RolePermission entity - join table that associates permissions with roles.
 * This allows many-to-many relationship between roles and permissions.
 */
@Entity('role_permissions')
@Index(['roleId'])
@Index(['permissionId'])
export class RolePermission extends BaseEntity {
  @Column({ type: 'uuid', name: 'role_id' })
  roleId: string;

  @ManyToOne(() => Role, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'uuid', name: 'permission_id' })
  permissionId: string;

  @ManyToOne(() => Permission, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
