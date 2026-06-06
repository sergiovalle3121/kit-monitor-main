import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { AppRole, isAppRole, permissionsFor, roleColumnFor } from './rbac';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<User> {
    const normalizedIdentifier = (identifier ?? '').trim();
    const normalizedPass = String(pass ?? '');
    const user =
      await this.usersService.findOneByIdentifier(normalizedIdentifier);

    if (
      !user ||
      user.isActive === false ||
      !(await bcrypt.compare(normalizedPass, user.password))
    ) {
      throw new UnauthorizedException('Credenciales incorrectas');
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
    const payload = { email: user.email, sub: user.id };
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

  async approve(id: string, actor: string) {
    const user = await this.usersService.update(id, {
      status: 'active',
      approvedAt: new Date(),
      approvedBy: actor,
    });
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
