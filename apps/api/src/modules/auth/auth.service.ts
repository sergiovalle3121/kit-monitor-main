import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { JwtPayload } from '../../common/types/jwt.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<User> {
    const normalizedIdentifier = (identifier ?? '').trim();
    const normalizedPass = String(pass ?? '');
    
    // Find user and include password_hash
    const user = await this.usersService.findOneByIdentifier(normalizedIdentifier);

    if (
      user &&
      user.isActive !== false &&
      (await bcrypt.compare(normalizedPass, user.passwordHash))
    ) {
      return user;
    }
    throw new UnauthorizedException('Credenciales incorrectas');
  }

  async login(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: 'UnifiedRole', // Roles are now managed by UserRoleAssignment
      tenant_id: user.tenantId ?? null,
      organization_id: null,
      plant_id: null,
      permissions: user.permissions ?? [],
      scopes: user.scopes ?? {},
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        tenant_id: user.tenantId,
        permissions: user.permissions ?? [],
        scopes: user.scopes ?? {},
      },
    };
  }
}
