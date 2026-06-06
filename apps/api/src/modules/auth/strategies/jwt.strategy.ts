import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  async validate(payload: any) {
    // Hydrate the request user with role/permissions/scopes so the
    // PermissionsGuard can authorize. Falls back to token claims if the user
    // record can't be loaded (keeps the request authenticated, not crashing).
    const base = { userId: payload.sub, id: payload.sub, email: payload.email };
    try {
      const user = await this.usersService.findOne(payload.sub);
      return {
        ...base,
        email: user.email ?? base.email,
        username: user.username,
        role: user.role,
        permissions: user.permissions ?? [],
        scopes: user.scopes ?? {},
      };
    } catch {
      return { ...base, permissions: [], scopes: {} };
    }
  }
}
