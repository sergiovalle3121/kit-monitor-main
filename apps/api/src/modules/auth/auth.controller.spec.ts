import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ALL_PERMISSIONS } from './rbac';

/**
 * Regresión del blindaje de acceso del owner (Tarea 1, capa 3 — backend `me`).
 * El dueño SIEMPRE resuelve admin + todos los permisos, derivado del EMAIL, aun
 * si el token viene viejo, sin rol o con casing raro.
 */
describe('AuthController.me — override del owner', () => {
  const controller = new AuthController({} as AuthService);

  it('owner sin rol en el token ⇒ Admin + ALL_PERMISSIONS', () => {
    const res = controller.me({
      user: { email: 'sergiovallezarate@gmail.com', role: '' },
    }) as { role: string; permissions: string[] };
    expect(res.role).toBe('Admin');
    expect(res.permissions).toEqual(ALL_PERMISSIONS);
  });

  it('owner con email en mayúsculas/espacios ⇒ Admin', () => {
    const res = controller.me({
      user: { email: '  SergioValleZarate@GMAIL.com ' },
    }) as { role: string; permissions: string[] };
    expect(res.role).toBe('Admin');
    expect(res.permissions.length).toBe(ALL_PERMISSIONS.length);
  });

  it('usuario normal se devuelve tal cual (sin tocar)', () => {
    const res = controller.me({
      user: {
        email: 'a@b.com',
        role: 'operator',
        permissions: ['production:execute'],
      },
    }) as { role: string; permissions: string[] };
    expect(res.role).toBe('operator');
    expect(res.permissions).toEqual(['production:execute']);
  });
});
