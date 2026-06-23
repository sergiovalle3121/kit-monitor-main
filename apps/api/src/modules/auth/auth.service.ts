import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { AppRole, isAppRole, isOwnerEmail, permissionsFor, roleColumnFor } from './rbac';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<User> {
    const normalizedIdentifier = (identifier ?? '').trim();
    // Trim surrounding whitespace; must mirror UsersService password hashing so
    // accidental spaces never silently break login.
    const normalizedPass = String(pass ?? '').trim();
    const user =
      await this.usersService.findOneByIdentifier(normalizedIdentifier);

    const passwordOk =
      !!user && (await bcrypt.compare(normalizedPass, user.password));
    if (!user || user.isActive === false || !passwordOk) {
      // Diagnostic (no secret values): which check failed + received length.
      console.warn(
        `[login] FAIL identifier="${normalizedIdentifier}" found=${!!user} active=${
          user ? user.isActive !== false : 'n/a'
        } passwordMatch=${passwordOk} recvLen=${normalizedPass.length}`,
      );
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    // The app owner is always full Admin (and active), regardless of how the
    // account was originally created. Password still had to match above. We also
    // refresh when the stored permissions are empty/stale (e.g. an older record
    // saved before admin carried the full permission set) so the owner is never
    // gated in the UI. Idempotent.
    if (isOwnerEmail(user.email)) {
      const fullPerms = permissionsFor('admin');
      const needsFix =
        user.role !== 'Admin' ||
        user.status === 'pending' ||
        (user.permissions?.length ?? 0) < fullPerms.length;
      if (needsFix) {
        return this.usersService.update(user.id, {
          role: 'Admin' as User['role'],
          permissions: fullPerms,
          status: 'active',
        });
      }
    }
    // Account lifecycle gate (existing users have status null → treated as active).
    if (user.status === 'pending') {
      throw new UnauthorizedException(
        'Tu cuenta está pendiente de aprobación por un administrador.',
      );
    }
    if (user.status === 'rejected') {
      throw new UnauthorizedException(
        'Tu cuenta fue rechazada. Contacta a un administrador.',
      );
    }
    return user;
  }

  login(user: User) {
    // Include role/permissions/tenant in the token so the frontend can decode
    // them for UI gating (read-only vs editable). The server still re-loads
    // these from the DB in JwtStrategy.validate() for authoritative checks.
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      permissions: user.permissions ?? [],
      tenant_id: user.tenantId ?? null,
      scopes: user.scopes ?? {},
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: this.publicUser(user),
    };
  }

  /** Self-registration → creates a PENDING user with role-derived permissions. */
  async register(dto: RegisterDto) {
    const email = (dto.email ?? '').trim().toLowerCase();
    if (!dto.name?.trim() || !email || !dto.password) {
      throw new BadRequestException('name, email y password son obligatorios.');
    }
    const existing = await this.usersService.findOneByEmail(email);
    if (existing)
      throw new BadRequestException('Ya existe un usuario con ese correo.');

    const role: AppRole = isAppRole(dto.role) ? dto.role : 'warehouse_operator';
    const buildings = dto.buildingId ? [dto.buildingId] : undefined;
    const user = await this.usersService.create({
      email,
      username: email,
      name: dto.name.trim(),
      position: dto.position ?? null,
      password: dto.password,
      role: roleColumnFor(role) as User['role'],
      permissions: permissionsFor(role),
      scopes: buildings ? { buildings } : {},
      tenantId: dto.tenantId ?? dto.buildingId ?? undefined,
      status: 'pending',
      isActive: true,
    });
    return this.publicUser(user);
  }

  /**
   * Trusted upsert from the frontend session identity → durable Postgres user
   * record + per-user JWT. Lets the bridge issue real per-user tokens (identity,
   * RBAC, audit, tenant) without moving password verification. Guarded upstream
   * by the shared frontend key.
   */
  async syncUser(dto: {
    email: string;
    name?: string;
    role?: string;
    position?: string;
    tenantId?: string;
    buildingId?: string;
  }) {
    const email = (dto.email ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('email es obligatorio.');
    // The owner email is always Admin even when the frontend session says otherwise.
    const role: AppRole = isOwnerEmail(email)
      ? 'admin'
      : (isAppRole(dto.role) ? dto.role : 'warehouse_operator');
    const tenantId = dto.tenantId ?? dto.buildingId ?? undefined;

    const existing = await this.usersService.findOneByEmail(email);
    let user: User;
    if (existing) {
      const patch: Partial<User> = {
        role: roleColumnFor(role) as User['role'],
        permissions: permissionsFor(role),
        status: 'active',
      };
      if (dto.name) patch.name = dto.name;
      if (dto.position) patch.position = dto.position;
      if (tenantId) patch.tenantId = tenantId;
      user = await this.usersService.update(existing.id, patch);
    } else {
      user = await this.usersService.create({
        email,
        username: email,
        name: dto.name ?? null,
        position: dto.position ?? null,
        password: randomUUID(), // unused: password auth happens in the frontend
        role: roleColumnFor(role) as User['role'],
        permissions: permissionsFor(role),
        scopes: {},
        tenantId,
        status: 'active',
        isActive: true,
      });
    }
    return this.login(user);
  }

  async approve(id: string, actor: string, role?: string) {
    const patch: Partial<User> = {
      status: 'active',
      approvedAt: new Date(),
      approvedBy: actor,
    };
    // The admin decides the role at approval time. The role the person picked at
    // registration is only a suggestion; when the admin passes a valid role we
    // (re)derive its permission set so the granted access matches the choice.
    if (isAppRole(role)) {
      patch.role = roleColumnFor(role) as User['role'];
      patch.permissions = permissionsFor(role);
    }
    const user = await this.usersService.update(id, patch);
    return this.publicUser(user);
  }

  async reject(id: string, actor: string) {
    const user = await this.usersService.update(id, {
      status: 'rejected',
      approvedBy: actor,
    });
    return this.publicUser(user);
  }

  async listPending() {
    return (await this.usersService.findByStatus('pending')).map((u) =>
      this.publicUser(u),
    );
  }

  async listUsers() {
    return (await this.usersService.findAll()).map((u) => this.publicUser(u));
  }

  private publicUser(u: User) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      position: u.position,
      permissions: u.permissions ?? [],
      scopes: u.scopes ?? {},
      tenantId: u.tenantId ?? null,
      status: u.status ?? 'active',
      createdAt: u.createdAt,
    };
  }
}
