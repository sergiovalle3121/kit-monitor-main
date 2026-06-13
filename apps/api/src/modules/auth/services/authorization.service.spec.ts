import { NotFoundException } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRoleAssignment } from '../entities/user-role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { User } from '../../users/entities/user.entity';

type RepoMock = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
};

const repo = (): RepoMock => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => x),
  remove: jest.fn(async () => undefined),
});

const perm = (id: string, resource: string, action: string): Permission =>
  ({ id, resource, action }) as unknown as Permission;

/**
 * Unit del AuthorizationService: los 5 repos de RBAC se simulan; se verifica el
 * union/dedup de permisos, los guardas 404 y la idempotencia de las asignaciones.
 */
describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let userRepo: RepoMock;
  let roleRepo: RepoMock;
  let permRepo: RepoMock;
  let userRoleRepo: RepoMock;
  let rolePermRepo: RepoMock;

  beforeEach(() => {
    userRepo = repo();
    roleRepo = repo();
    permRepo = repo();
    userRoleRepo = repo();
    rolePermRepo = repo();
    service = new AuthorizationService(
      userRepo as never,
      roleRepo as never,
      permRepo as never,
      userRoleRepo as never,
      rolePermRepo as never,
    );
  });

  describe('getUserPermissions', () => {
    it('devuelve [] cuando el usuario no tiene roles asignados', async () => {
      userRoleRepo.find.mockResolvedValue([]);
      const res = await service.getUserPermissions('u1', 't1');
      expect(res).toEqual([]);
      expect(rolePermRepo.find).not.toHaveBeenCalled();
    });

    it('une permisos de múltiples roles y deduplica por id', async () => {
      userRoleRepo.find.mockResolvedValue([
        { roleId: 'r1', role: {} },
        { roleId: 'r2', role: {} },
      ]);
      const pRead = perm('p-read', 'inventory', 'read');
      rolePermRepo.find.mockResolvedValue([
        { permission: pRead },
        { permission: perm('p-write', 'inventory', 'write') },
        { permission: pRead }, // duplicado → debe colapsar
        { permission: null }, // sin permiso → se ignora
      ]);
      const res = await service.getUserPermissions('u1', 't1');
      expect(res.map((p) => p.id).sort()).toEqual(['p-read', 'p-write']);
    });
  });

  describe('hasPermission', () => {
    it('true sólo si existe el par resource+action', async () => {
      userRoleRepo.find.mockResolvedValue([{ roleId: 'r1', role: {} }]);
      rolePermRepo.find.mockResolvedValue([
        { permission: perm('p1', 'inventory', 'read') },
      ]);
      await expect(service.hasPermission('u1', 't1', 'inventory', 'read')).resolves.toBe(true);

      userRoleRepo.find.mockResolvedValue([{ roleId: 'r1', role: {} }]);
      rolePermRepo.find.mockResolvedValue([
        { permission: perm('p1', 'inventory', 'read') },
      ]);
      await expect(service.hasPermission('u1', 't1', 'finance', 'write')).resolves.toBe(false);
    });
  });

  describe('getUserRoles', () => {
    it('mapea las asignaciones a roles y descarta los nulos', async () => {
      const r1 = { id: 'r1', name: 'planner' } as unknown as Role;
      userRoleRepo.find.mockResolvedValue([{ role: r1 }, { role: null }]);
      const res = await service.getUserRoles('u1', 't1');
      expect(res).toEqual([r1]);
    });
  });

  describe('findRoleById / findPermissionById', () => {
    it('findRoleById lanza 404 si no existe', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      await expect(service.findRoleById('rX')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findRoleById devuelve el rol con permisos', async () => {
      const r = { id: 'r1', name: 'planner' } as unknown as Role;
      roleRepo.findOne.mockResolvedValue(r);
      await expect(service.findRoleById('r1')).resolves.toBe(r);
    });

    it('findPermissionById lanza 404 si no existe', async () => {
      permRepo.findOne.mockResolvedValue(null);
      await expect(service.findPermissionById('pX')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getRolePermissions', () => {
    it('extrae permisos del rol y descarta nulos', async () => {
      rolePermRepo.find.mockResolvedValue([
        { permission: perm('p1', 'a', 'read') },
        { permission: null },
      ]);
      const res = await service.getRolePermissions('r1');
      expect(res.map((p) => p.id)).toEqual(['p1']);
    });
  });

  describe('assignPermissionToRole', () => {
    it('es idempotente: devuelve la asociación existente sin crear otra', async () => {
      roleRepo.findOne.mockResolvedValue({ id: 'r1' });
      permRepo.findOne.mockResolvedValue({ id: 'p1' });
      const existing = { id: 'rp1', roleId: 'r1', permissionId: 'p1' } as unknown as RolePermission;
      rolePermRepo.findOne.mockResolvedValue(existing);

      const res = await service.assignPermissionToRole('r1', 'p1');
      expect(res).toBe(existing);
      expect(rolePermRepo.save).not.toHaveBeenCalled();
    });

    it('crea la asociación cuando no existe (tras validar rol y permiso)', async () => {
      roleRepo.findOne.mockResolvedValue({ id: 'r1' });
      permRepo.findOne.mockResolvedValue({ id: 'p1' });
      rolePermRepo.findOne.mockResolvedValue(null);

      const res = await service.assignPermissionToRole('r1', 'p1');
      expect(rolePermRepo.create).toHaveBeenCalledWith({ roleId: 'r1', permissionId: 'p1' });
      expect(rolePermRepo.save).toHaveBeenCalled();
      expect(res).toMatchObject({ roleId: 'r1', permissionId: 'p1' });
    });

    it('propaga 404 si el rol no existe', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      await expect(service.assignPermissionToRole('rX', 'p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('removePermissionFromRole', () => {
    it('elimina cuando existe', async () => {
      const rp = { id: 'rp1' };
      rolePermRepo.findOne.mockResolvedValue(rp);
      await service.removePermissionFromRole('r1', 'p1');
      expect(rolePermRepo.remove).toHaveBeenCalledWith(rp);
    });

    it('no falla cuando no existe', async () => {
      rolePermRepo.findOne.mockResolvedValue(null);
      await expect(service.removePermissionFromRole('r1', 'p1')).resolves.toBeUndefined();
      expect(rolePermRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('assignRoleToUser', () => {
    it('lanza 404 si el usuario no está en el tenant', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.assignRoleToUser('uX', 'r1', 't1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('es idempotente con una asignación previa', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1' } as unknown as User);
      roleRepo.findOne.mockResolvedValue({ id: 'r1' });
      const existing = { id: 'ur1' } as unknown as UserRoleAssignment;
      userRoleRepo.findOne.mockResolvedValue(existing);
      const res = await service.assignRoleToUser('u1', 'r1', 't1', 'plant1');
      expect(res).toBe(existing);
      expect(userRoleRepo.save).not.toHaveBeenCalled();
    });

    it('crea la asignación (plantId nulo cuando no se pasa)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1' } as unknown as User);
      roleRepo.findOne.mockResolvedValue({ id: 'r1' });
      userRoleRepo.findOne.mockResolvedValue(null);
      await service.assignRoleToUser('u1', 'r1', 't1');
      expect(userRoleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', roleId: 'r1', tenantId: 't1', plantId: null }),
      );
      expect(userRoleRepo.save).toHaveBeenCalled();
    });
  });

  describe('revokeUserRole / getAllRoles / findRoleByName', () => {
    it('revokeUserRole elimina si existe', async () => {
      const ur = { id: 'ur1' };
      userRoleRepo.findOne.mockResolvedValue(ur);
      await service.revokeUserRole('ur1');
      expect(userRoleRepo.remove).toHaveBeenCalledWith(ur);
    });

    it('getAllRoles delega al repo de roles', async () => {
      roleRepo.find.mockResolvedValue([{ id: 'r1' }]);
      const res = await service.getAllRoles();
      expect(res).toHaveLength(1);
    });

    it('findRoleByName devuelve null cuando no existe', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      await expect(service.findRoleByName('nope')).resolves.toBeNull();
    });
  });
});
