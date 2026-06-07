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
 *
 * NOTE: the authoritative runtime RBAC matrix is `auth/rbac.ts` (consumed by
 * AuthService at login → User.permissions → PermissionsGuard). This DB seed is a
 * secondary, optional catalog kept aligned with that vocabulary; it is extended
 * additively so any external tooling reading the roles/permissions tables sees
 * the same shop-floor permissions. Do not treat it as the source of truth.
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
  // ── Shop-floor roles (aligned with auth/rbac.ts) ─────────────────────────
  { name: 'Planner', description: 'Publica el plan y libera órdenes de trabajo.' },
  { name: 'Materialist', description: 'Surte y monta material a estación; e-kanban.' },
  { name: 'IndustrialEngineer', description: 'Dispone líneas: ruteo, layout y balanceo.' },
  { name: 'QualityEngineer', description: 'Holds de calidad y disposición MRB.' },
  { name: 'MRBMember', description: 'Disposición de material en el comité MRB.' },
  { name: 'CycleCountAnalyst', description: 'Concilia inventario contra conteos.' },
  { name: 'MaintenanceTech', description: 'Atiende andon de máquina y mantenimiento.' },
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
  // ── Shop-floor permission vocabulary (aligned with auth/rbac.ts) ──────────
  { resource: 'planning', action: 'read', description: 'Leer el plan de producción' },
  { resource: 'planning', action: 'write', description: 'Editar el plan de producción' },
  { resource: 'planning', action: 'publish', description: 'Publicar el plan / liberar WOs' },
  { resource: 'production', action: 'execute', description: 'Ejecutar una WO en estación (operador)' },
  { resource: 'production', action: 'authorize', description: 'Autorizar a un operador a una WO' },
  { resource: 'materials', action: 'read', description: 'Leer materiales' },
  { resource: 'materials', action: 'request', description: 'Solicitar material a almacén' },
  { resource: 'materials', action: 'stage', description: 'Surtir / montar material a estación' },
  { resource: 'quality', action: 'report', description: 'Reportar defecto desde estación' },
  { resource: 'quality', action: 'hold', description: 'Colocar retención de calidad (hold)' },
  { resource: 'quality', action: 'disposition', description: 'Disponer material en MRB' },
  { resource: 'inventory', action: 'reconcile', description: 'Conciliar inventario (conteos)' },
  { resource: 'engineering', action: 'read', description: 'Leer datos de ingeniería' },
  { resource: 'engineering', action: 'write', description: 'Editar ruteo / layout de línea' },
  { resource: 'maintenance', action: 'read', description: 'Leer mantenimiento' },
  { resource: 'maintenance', action: 'write', description: 'Atender mantenimiento / andon de máquina' },
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
    ['production', 'execute'],
    ['production', 'authorize'],
    ['quality', 'read'],
    ['quality', 'report'],
    ['inventory', 'read'],
    ['engineering', 'read'],
  ],
  Operator: [
    ['production', 'read'],
    ['production', 'write'],
    ['production', 'execute'],
    ['quality', 'report'],
    ['materials', 'read'],
  ],
  // ── Shop-floor role assignments (aligned with auth/rbac.ts) ──────────────
  Planner: [
    ['planning', 'read'],
    ['planning', 'write'],
    ['planning', 'publish'],
    ['production', 'read'],
    ['materials', 'read'],
    ['inventory', 'read'],
  ],
  Materialist: [
    ['materials', 'read'],
    ['materials', 'stage'],
    ['materials', 'request'],
    ['inventory', 'read'],
  ],
  IndustrialEngineer: [
    ['engineering', 'read'],
    ['engineering', 'write'],
    ['production', 'read'],
    ['materials', 'read'],
  ],
  QualityEngineer: [
    ['quality', 'read'],
    ['quality', 'write'],
    ['quality', 'hold'],
    ['quality', 'report'],
    ['quality', 'disposition'],
    ['production', 'read'],
    ['materials', 'read'],
  ],
  MRBMember: [
    ['quality', 'disposition'],
    ['quality', 'read'],
    ['engineering', 'read'],
    ['materials', 'read'],
  ],
  CycleCountAnalyst: [
    ['inventory', 'read'],
    ['inventory', 'reconcile'],
    ['reports', 'read'],
  ],
  MaintenanceTech: [
    ['maintenance', 'read'],
    ['maintenance', 'write'],
    ['production', 'read'],
  ],
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
