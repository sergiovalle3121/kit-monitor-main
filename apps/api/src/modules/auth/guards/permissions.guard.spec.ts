import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../governance/audit.service';

/**
 * Regresión del blindaje de acceso del owner (Tarea 1, capa 3 — PermissionsGuard).
 * El owner (por EMAIL) pasa SIEMPRE, sin el permiso explícito; admin pasa
 * case-insensitive; un usuario sin el permiso es rechazado.
 */
function setup(user: unknown, required?: string[]) {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const guard = new PermissionsGuard(reflector, audit);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user, query: {}, params: {}, body: {} }),
    }),
    getHandler: () => null,
    getClass: () => null,
  } as never;
  return { guard, context };
}

describe('PermissionsGuard — override owner/admin', () => {
  it('owner (por email) pasa SIN el permiso explícito', async () => {
    const { guard, context } = setup(
      {
        email: 'sergiovallezarate@gmail.com',
        role: 'operator',
        permissions: [],
      },
      ['finance:write'],
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('admin (case-insensitive) pasa', async () => {
    const { guard, context } = setup(
      { email: 'a@b.com', role: 'admin', permissions: [] },
      ['finance:write'],
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('usuario SIN el permiso es rechazado (403)', async () => {
    const { guard, context } = setup(
      {
        email: 'a@b.com',
        role: 'operator',
        permissions: ['production:execute'],
      },
      ['finance:write'],
    );
    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('usuario CON el permiso requerido pasa', async () => {
    const { guard, context } = setup(
      { email: 'a@b.com', role: 'operator', permissions: ['finance:write'] },
      ['finance:write'],
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
