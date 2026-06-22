import { BadRequestException, UnauthorizedException } from '@nestjs/common';
jest.mock('bcrypt', () => ({ compare: jest.fn() }));
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { ALL_PERMISSIONS, permissionsFor } from './rbac';

/**
 * Unit del AuthService con `UsersService`/`JwtService` simulados y bcrypt espiado.
 * Verifica el camino de credenciales, el override del owner, el ciclo de cuenta
 * (pending/rejected) y la derivación de rol→permisos en register/syncUser.
 */
describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<
    Pick<
      UsersService,
      | 'findOneByIdentifier'
      | 'findOneByEmail'
      | 'create'
      | 'update'
      | 'findByStatus'
      | 'findAll'
    >
  >;
  let jwt: { sign: jest.Mock };

  const baseUser = (over: Partial<User> = {}): User =>
    ({
      id: 'u1',
      name: 'Ana',
      email: 'ana@axos.test',
      username: 'ana@axos.test',
      password: 'hashed',
      role: 'warehouse_operator',
      position: null,
      permissions: ['inventory:read'],
      scopes: {},
      tenantId: 't1',
      status: 'active',
      isActive: true,
      createdAt: new Date('2026-01-01'),
      ...over,
    }) as unknown as User;

  beforeEach(() => {
    users = {
      findOneByIdentifier: jest.fn(),
      findOneByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findByStatus: jest.fn(),
      findAll: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    service = new AuthService(users as unknown as UsersService, jwt as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('validateUser', () => {
    it('lanza Unauthorized si el usuario no existe', async () => {
      users.findOneByIdentifier.mockResolvedValue(null as never);
      await expect(service.validateUser('nadie', 'x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('lanza Unauthorized si la contraseña no coincide', async () => {
      users.findOneByIdentifier.mockResolvedValue(baseUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.validateUser('ana@axos.test', 'mala'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza Unauthorized si la cuenta está inactiva (aunque la clave sea válida)', async () => {
      users.findOneByIdentifier.mockResolvedValue(baseUser({ isActive: false }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(
        service.validateUser('ana@axos.test', 'buena'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('devuelve el usuario en el camino feliz y recorta espacios del identificador', async () => {
      const u = baseUser();
      users.findOneByIdentifier.mockResolvedValue(u);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const res = await service.validateUser('  ana@axos.test  ', '  buena  ');
      expect(res).toBe(u);
      expect(users.findOneByIdentifier).toHaveBeenCalledWith('ana@axos.test');
    });

    it('bloquea cuentas pending/rejected con mensajes específicos', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      users.findOneByIdentifier.mockResolvedValue(baseUser({ status: 'pending' }));
      await expect(service.validateUser('ana@axos.test', 'x')).rejects.toThrow(
        /pendiente de aprobación/,
      );

      users.findOneByIdentifier.mockResolvedValue(
        baseUser({ status: 'rejected' }),
      );
      await expect(service.validateUser('ana@axos.test', 'x')).rejects.toThrow(
        /rechazada/,
      );
    });

    it('owner con rol/permiso stale ⇒ se auto-promueve a Admin con permisos completos', async () => {
      const owner = baseUser({
        email: 'sergiovallezarate@gmail.com',
        role: 'warehouse_operator' as never,
        permissions: [],
        status: 'pending',
      });
      users.findOneByIdentifier.mockResolvedValue(owner);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const fixed = baseUser({ email: owner.email, role: 'Admin' as never });
      users.update.mockResolvedValue(fixed);

      const res = await service.validateUser(owner.email, 'buena');

      expect(users.update).toHaveBeenCalledWith(
        owner.id,
        expect.objectContaining({
          role: 'Admin',
          status: 'active',
          permissions: permissionsFor('admin'),
        }),
      );
      expect(res).toBe(fixed);
    });

    it('owner ya correcto (Admin + permisos completos) no dispara update', async () => {
      const owner = baseUser({
        email: 'sergiovallezarate@gmail.com',
        role: 'Admin' as never,
        permissions: permissionsFor('admin'),
        status: 'active',
      });
      users.findOneByIdentifier.mockResolvedValue(owner);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const res = await service.validateUser(owner.email, 'buena');
      expect(users.update).not.toHaveBeenCalled();
      expect(res).toBe(owner);
    });
  });

  describe('login', () => {
    it('firma un JWT con el claim shape esperado y devuelve el usuario público', () => {
      const u = baseUser({ permissions: ['inventory:read'], scopes: { buildings: ['b1'] } });
      const out = service.login(u);
      expect(out.access_token).toBe('signed.jwt.token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          email: u.email,
          sub: u.id,
          role: u.role,
          permissions: ['inventory:read'],
          tenant_id: 't1',
          scopes: { buildings: ['b1'] },
        }),
      );
      // publicUser no expone el hash de contraseña.
      expect((out.user as Record<string, unknown>).password).toBeUndefined();
      expect(out.user.email).toBe(u.email);
    });
  });

  describe('register', () => {
    it('rechaza payloads incompletos', async () => {
      await expect(
        service.register({ name: '', email: '', password: '' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza correos duplicados', async () => {
      users.findOneByEmail.mockResolvedValue(baseUser());
      await expect(
        service.register({
          name: 'Ana',
          email: 'ana@axos.test',
          password: 'pw',
        } as never),
      ).rejects.toThrow(/Ya existe un usuario/);
    });

    it('crea un usuario PENDING con permisos derivados del rol y scope de building', async () => {
      users.findOneByEmail.mockResolvedValue(null as never);
      users.create.mockImplementation(async (dto) => baseUser(dto as Partial<User>));

      await service.register({
        name: '  Beto  ',
        email: '  Beto@AXOS.test ',
        password: 'pw',
        role: 'quality_engineer',
        buildingId: 'b9',
      } as never);

      const arg = users.create.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.email).toBe('beto@axos.test'); // normalizado a minúsculas
      expect(arg.name).toBe('Beto'); // recortado
      expect(arg.role).toBe('quality_engineer');
      expect(arg.permissions).toEqual(permissionsFor('quality_engineer'));
      expect(arg.scopes).toEqual({ buildings: ['b9'] });
      expect(arg.status).toBe('pending');
    });

    it('un rol desconocido cae a warehouse_operator', async () => {
      users.findOneByEmail.mockResolvedValue(null as never);
      users.create.mockImplementation(async (dto) => baseUser(dto as Partial<User>));
      await service.register({
        name: 'C',
        email: 'c@axos.test',
        password: 'pw',
        role: 'rol_inexistente',
      } as never);
      const arg = users.create.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.role).toBe('warehouse_operator');
    });
  });

  describe('syncUser', () => {
    it('exige email', async () => {
      await expect(service.syncUser({ email: '' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('usuario nuevo ⇒ create + login', async () => {
      users.findOneByEmail.mockResolvedValue(null as never);
      const created = baseUser({ email: 'new@axos.test' });
      users.create.mockResolvedValue(created);
      const out = await service.syncUser({ email: 'New@axos.test', name: 'New' });
      expect(users.create).toHaveBeenCalled();
      expect(out.access_token).toBe('signed.jwt.token');
    });

    it('usuario existente ⇒ update + login', async () => {
      const existing = baseUser();
      users.findOneByEmail.mockResolvedValue(existing);
      users.update.mockResolvedValue(existing);
      const out = await service.syncUser({
        email: existing.email,
        name: 'Ana2',
        position: 'Lead',
      });
      expect(users.update).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({ status: 'active', name: 'Ana2', position: 'Lead' }),
      );
      expect(out.access_token).toBe('signed.jwt.token');
    });

    it('el owner siempre se sincroniza como Admin con permisos completos', async () => {
      users.findOneByEmail.mockResolvedValue(null as never);
      users.create.mockImplementation(async (dto) => baseUser(dto as Partial<User>));
      await service.syncUser({
        email: 'sergiovallezarate@gmail.com',
        role: 'operator',
      });
      const arg = users.create.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.role).toBe('Admin');
      expect(arg.permissions).toEqual(ALL_PERMISSIONS);
    });
  });

  describe('lifecycle helpers', () => {
    it('approve marca active con sello de aprobador', async () => {
      users.update.mockImplementation(async (_id, dto) => baseUser(dto as Partial<User>));
      await service.approve('u1', 'admin@axos.test');
      expect(users.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ status: 'active', approvedBy: 'admin@axos.test' }),
      );
    });

    it('reject marca rejected', async () => {
      users.update.mockImplementation(async (_id, dto) => baseUser(dto as Partial<User>));
      await service.reject('u1', 'admin@axos.test');
      expect(users.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ status: 'rejected' }),
      );
    });

    it('listPending/listUsers proyectan al usuario público (sin password)', async () => {
      users.findByStatus.mockResolvedValue([baseUser()]);
      users.findAll.mockResolvedValue([baseUser(), baseUser({ id: 'u2' })]);

      const pending = await service.listPending();
      expect(users.findByStatus).toHaveBeenCalledWith('pending');
      expect((pending[0] as Record<string, unknown>).password).toBeUndefined();

      const all = await service.listUsers();
      expect(all).toHaveLength(2);
      expect((all[0] as Record<string, unknown>).password).toBeUndefined();
    });
  });
});
