import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRoleAssignment } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';

/**
 * AuthorizationService - Core service for permission and role management.
 * 
 * This service provides methods to:
 * - Get all effective permissions for a user within a tenant
 * - Check if a user has a specific permission
 * - Get all roles assigned to a user
 * 
 * All queries are scoped by tenantId to ensure multi-tenant isolation.
 */
@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(UserRoleAssignment)
    private readonly userRoleRepository: Repository<UserRoleAssignment>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  /**
   * Gets all effective permissions for a user within a specific tenant.
   * This method unions all permissions from all roles assigned to the user.
   * 
   * @param userId - The UUID of the user
   * @param tenantId - The UUID of the tenant
   * @returns Array of Permission objects that the user has
   */
  async getUserPermissions(
    userId: string,
    tenantId: string,
  ): Promise<Permission[]> {
    // Find all role assignments for this user in this tenant
    const userRoles = await this.userRoleRepository.find({
      where: { userId, tenantId },
      relations: ['role'],
    });

    if (userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map((ur) => ur.roleId);

    // Find all role-permission associations for these roles
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: In(roleIds) },
      relations: ['permission'],
    });

    // Extract unique permissions
    const permissionMap = new Map<string, Permission>();
    rolePermissions.forEach((rp) => {
      if (rp.permission) {
        permissionMap.set(rp.permission.id, rp.permission);
      }
    });

    return Array.from(permissionMap.values());
  }

  /**
   * Checks if a user has a specific permission within a tenant.
   * 
   * @param userId - The UUID of the user
   * @param tenantId - The UUID of the tenant
   * @param resource - The resource name (e.g., 'finance', 'inventory')
   * @param action - The action name (e.g., 'read', 'write')
   * @returns true if the user has the permission, false otherwise
   */
  async hasPermission(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, tenantId);
    return permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
  }

  /**
   * Gets all roles assigned to a user within a specific tenant.
   * 
   * @param userId - The UUID of the user
   * @param tenantId - The UUID of the tenant
   * @returns Array of Role objects assigned to the user
   */
  async getUserRoles(userId: string, tenantId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, tenantId },
      relations: ['role'],
    });

    return userRoles.map((ur) => ur.role).filter((r): r is Role => r !== null);
  }

  /**
   * Gets detailed role assignments for a user, including plant scope.
   * 
   * @param userId - The UUID of the user
   * @param tenantId - The UUID of the tenant
   * @returns Array of UserRoleAssignment with full relations
   */
  async getUserRoleAssignments(
    userId: string,
    tenantId: string,
  ): Promise<UserRoleAssignment[]> {
    return await this.userRoleRepository.find({
      where: { userId, tenantId },
      relations: ['role', 'plant'],
    });
  }

  /**
   * Finds a role by its ID.
   * 
   * @param roleId - The UUID of the role
   * @returns The Role object or throws NotFoundException
   */
  async findRoleById(roleId: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    return role;
  }

  /**
   * Finds a permission by its ID.
   * 
   * @param permissionId - The UUID of the permission
   * @returns The Permission object or throws NotFoundException
   */
  async findPermissionById(permissionId: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission with ID ${permissionId} not found`,
      );
    }

    return permission;
  }

  /**
   * Gets all permissions associated with a specific role.
   * 
   * @param roleId - The UUID of the role
   * @returns Array of Permission objects
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId },
      relations: ['permission'],
    });

    return rolePermissions
      .map((rp) => rp.permission)
      .filter((p): p is Permission => p !== null);
  }

  /**
   * Assigns a permission to a role.
   * 
   * @param roleId - The UUID of the role
   * @param permissionId - The UUID of the permission
   * @returns The created RolePermission association
   */
  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission> {
    // Verify role and permission exist
    await this.findRoleById(roleId);
    await this.findPermissionById(permissionId);

    // Check if association already exists
    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (existing) {
      return existing;
    }

    const rolePermission = this.rolePermissionRepository.create({
      roleId,
      permissionId,
    });

    return await this.rolePermissionRepository.save(rolePermission);
  }

  /**
   * Removes a permission from a role.
   * 
   * @param roleId - The UUID of the role
   * @param permissionId - The UUID of the permission
   */
  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    const rolePermission = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (rolePermission) {
      await this.rolePermissionRepository.remove(rolePermission);
    }
  }

  /**
   * Assigns a role to a user within a tenant (and optionally a plant).
   * 
   * @param userId - The UUID of the user
   * @param roleId - The UUID of the role
   * @param tenantId - The UUID of the tenant
   * @param plantId - Optional UUID of the plant (null for tenant-wide role)
   * @returns The created UserRoleAssignment
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    tenantId: string,
    plantId?: string | null,
  ): Promise<UserRoleAssignment> {
    // Verify user, role, and tenant exist
    const user = await this.userRepository.findOne({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${userId} not found in tenant ${tenantId}`,
      );
    }

    await this.findRoleById(roleId);

    // Check if assignment already exists
    const existing = await this.userRoleRepository.findOne({
      where: {
        userId,
        roleId,
        tenantId,
        plantId: plantId ?? null,
      },
    });

    if (existing) {
      return existing;
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      tenantId,
      plantId: plantId ?? null,
    });

    return await this.userRoleRepository.save(userRole);
  }

  /**
   * Revokes a role assignment from a user.
   * 
   * @param userRoleId - The UUID of the UserRoleAssignment
   */
  async revokeUserRole(userRoleId: string): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id: userRoleId },
    });

    if (userRole) {
      await this.userRoleRepository.remove(userRole);
    }
  }

  /**
   * Gets all system roles.
   * 
   * @returns Array of all Role objects
   */
  async getAllRoles(): Promise<Role[]> {
    return await this.roleRepository.find({
      relations: ['permissions'],
    });
  }

  /**
   * Finds a role by its name.
   * 
   * @param name - The name of the role
   * @returns The Role object or null if not found
   */
  async findRoleByName(name: string): Promise<Role | null> {
    return await this.roleRepository.findOne({
      where: { name },
      relations: ['permissions'],
    });
  }
}
