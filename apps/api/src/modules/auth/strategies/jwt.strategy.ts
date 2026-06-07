import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { getJwtSecret } from '../../../common/config/jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    // Hydrate the request user with identity + role/permissions/scopes + tenant
    // so PermissionsGuard authorizes and TenantInterceptor/TenantContext scope
    // queries. Falls back to token claims if the user record can't be loaded.
    const base = { userId: payload.sub, id: payload.sub, email: payload.email };
    try {
      const user = await this.usersService.findOne(payload.sub);
      return {
        ...base,
        email: user.email ?? base.email,
        username: user.username,
        name: user.name ?? null,
        position: user.position ?? null,
        role: user.role,
        permissions: user.permissions ?? [],
        scopes: user.scopes ?? {},
        status: user.status ?? 'active',
        // Consumed by TenantInterceptor → TenantContextService for row-level scoping.
        tenant_id: user.tenantId ?? null,
      };
    } catch {
      return { ...base, permissions: [], scopes: {}, tenant_id: null };
    }
  }
}
