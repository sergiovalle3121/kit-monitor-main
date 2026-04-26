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
    const user = await this.usersService.findOneByIdentifier(normalizedIdentifier);

    if (user && user.isActive !== false && (await bcrypt.compare(normalizedPass, user.password))) {
      return user;
    }
    throw new UnauthorizedException('Credenciales incorrectas');
  }

  async login(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id ?? null,
      organization_id: user.organization_id ?? null,
      plant_id: user.plant_id ?? null,
      permissions: user.permissions ?? null,
      scopes: user.scopes ?? null,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        tenant_id: user.tenant_id,
        organization_id: user.organization_id,
        plant_id: user.plant_id,
        permissions: user.permissions ?? [],
        scopes: user.scopes ?? {},
      },
    };
  }
}
