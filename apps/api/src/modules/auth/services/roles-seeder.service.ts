import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';

/**
 * Seed data for default roles and permissions.
 * This data is idempotent - running it multiple times won't create duplicates.
 */

/**
 * Default system roles with descriptions
 */
const DEFAULT_ROLES = [
  {
    name: 'SystemAdmin',
    description:
      'Acceso total, configura tenants y plantas. Máximo nivel de privilegios.',
  },
  {
    name: 'ExecutiveManager',
    description:
      'Dashboard financiero/operativo de todas las plantas, solo lectura en módulos sensibles.',
  },
  {
    name: 'PlantManager',
    description:
      'Gestión completa de su planta asignada (producción, calidad, inventario, compras).',
  },
  {
    name: 'Supervisor',
    description:
      'Ejecución en piso, registro de producción, paros, calidad básica.',
  },
  {
    name: 'Operator',
    description:
      'Solo registro de producción en su estación, escaneo, reporte de fallas.',
  },
];

/**
 * Default permissions by resource and action
 */
const DEFAULT_PERMISSIONS = [
  { resource: 'finance', action: 'read', description: 'Leer datos financieros' },
  {
    resource: 'finance',
    action: 'write',
    description: 'Escribir/modificar datos financieros',
  },
  {
    resource: 'inventory',
    action: 'read',
    description: 'Leer datos de inventario',
  },
  {
    resource: 'inventory',
    action: 'write',
    description: 'Escribir/modificar datos de inventario',
  },
  {
    resource: 'production',
    action: 'read',
    description: 'Leer datos de producción',
  },
  {
    resource: 'production',
    action: 'write',
    description: 'Escribir/modificar datos de producción',
  },
  { resource: 'quality', action: 'read', description: 'Leer datos de calidad' },
  {
    resource: 'quality',
    action: 'write',
    description: 'Escribir/modificar datos de calidad',
  },
  {
    resource: 'procurement',
    action: 'read',
    description: 'Leer datos de compras/procura',
  },
  {
    resource: 'procurement',
    action: 'write',
    description: 'Escribir/modificar datos de compras/procura',
  },
  { resource: 'auth', action: 'read', description: 'Leer configuración de auth' },
  {
    resource: 'auth',
    action: 'write',
    description: 'Gestionar usuarios y roles',
  },
  { resource: 'reports', action: 'read', description: 'Leer reportes' },
  {
    resource: 'settings',
    action: 'read',
    description: 'Leer configuración del sistema',
  },
  {
    resource: 'settings',
    action: 'write',
    description: 'Escribir configuración del sistema',
  },
];

/**
 * Permission assignments for each role
 * Format: roleName -> array of [resource, action] tuples
 */
const ROLE_PERMISSIONS: Record<string, [string, string][]> = {
  SystemAdmin: [
    ['finance', 'read'],
    ['finance', 'write'],
    ['inventory', 'read'],
    ['inventory', 'write'],
    ['production', 'read'],
    ['production', 'write'],
    ['quality', 'read'],
    ['quality', 'write'],
    ['procurement', 'read'],
    ['procurement', 'write'],
    ['auth', 'read'],
    ['auth', 'write'],
    ['reports', 'read'],
    ['settings', 'read'],
    ['settings', 'write'],
  ],
  ExecutiveManager: [
    ['finance', 'read'],
    ['inventory', 'read'],
    ['production', 'read'],
    ['quality', 'read'],
    ['procurement', 'read'],
    ['reports', 'read'],
    ['settings', 'read'],
  ],
  PlantManager: [
    ['finance', 'read'],
    ['inventory', 'read'],
    ['inventory', 'write'],
    ['production', 'read'],
    ['production', 'write'],
    ['quality', 'read'],
    ['quality', 'write'],
    ['procurement', 'read'],
    ['procurement', 'write'],
    ['auth', 'read'],
    ['reports', 'read'],
    ['settings', 'read'],
  ],
  Supervisor: [
    ['production', 'read'],
    ['production', 'write'],
    ['quality', 'read'],
    ['inventory', 'read'],
  ],
  Operator: [['production', 'read'], ['production', 'write']],
};

/**
 * RolesSeederService - Service for seeding initial roles and permissions.
 * 
 * This service provides an idempotent method to seed the database with
 * default roles and permissions. It can be called via a controller endpoint
 * or during application bootstrap.
 */
@Injectable()
export class RolesSeederService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  /**
   * Seeds all default roles and permissions.
   * This method is idempotent - safe to run multiple times.
   * 
   * @returns Object with counts of created/found items
   */
  async seed(): Promise<{
    rolesCreated: number;
    permissionsCreated: number;
    assignmentsCreated: number;
  }> {
    let rolesCreated = 0;
    let permissionsCreated = 0;
    let assignmentsCreated = 0;

    // Step 1: Create default permissions
    const permissionMap = new Map<string, Permission>();
    for (const permData of DEFAULT_PERMISSIONS) {
      const existing = await this.permissionRepository.findOne({
        where: { resource: permData.resource, action: permData.action },
      });

      if (!existing) {
        const permission = this.permissionRepository.create({
          resource: permData.resource,
          action: permData.action,
          description: permData.description,
        });
        await this.permissionRepository.save(permission);
        permissionsCreated++;
        permissionMap.set(
          `${permData.resource}:${permData.action}`,
          permission,
        );
      } else {
        permissionMap.set(`${permData.resource}:${permData.action}`, existing);
      }
    }

    // Step 2: Create default roles
    const roleMap = new Map<string, Role>();
    for (const roleData of DEFAULT_ROLES) {
      const existing = await this.roleRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existing) {
        const role = this.roleRepository.create({
          name: roleData.name,
          description: roleData.description,
        });
        await this.roleRepository.save(role);
        rolesCreated++;
        roleMap.set(roleData.name, role);
      } else {
        roleMap.set(roleData.name, existing);
      }
    }

    // Step 3: Assign permissions to roles
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const role = roleMap.get(roleName);
      if (!role) continue;

      for (const [resource, action] of permissions) {
        const permission = permissionMap.get(`${resource}:${action}`);
        if (!permission) continue;

        const existing = await this.rolePermissionRepository.findOne({
          where: { roleId: role.id, permissionId: permission.id },
        });

        if (!existing) {
          const rolePermission = this.rolePermissionRepository.create({
            roleId: role.id,
            permissionId: permission.id,
          });
          await this.rolePermissionRepository.save(rolePermission);
          assignmentsCreated++;
        }
      }
    }

    return {
      rolesCreated,
      permissionsCreated,
      assignmentsCreated,
    };
  }

  /**
   * Gets all default role names
   */
  getDefaultRoleNames(): string[] {
    return DEFAULT_ROLES.map((r) => r.name);
  }
}
