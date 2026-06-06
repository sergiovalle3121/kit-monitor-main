import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../governance/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    // GET/DELETE requests have no parsed body, so default these to {} to avoid
    // dereferencing undefined during the organizational scope checks below.
    const query = request.query ?? {};
    const params = request.params ?? {};
    const body = request.body ?? {};

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // 1. Admin Bypass
    if (user.role === 'Admin') {
      return true;
    }

    // 2. Permission Check
    if (requiredPermissions) {
      const hasPermission = requiredPermissions.every((permission) =>
        user.permissions?.includes(permission),
      );

      if (!hasPermission) {
        await this.audit.log({
          actor: user.email,
          action: 'PERMISSION_DENIED',
          entity: 'Endpoint',
          result: 'DENIED',
          reason: `Missing permissions: ${requiredPermissions.join(', ')}`,
          scope: user.scopes,
        });
        throw new ForbiddenException(
          `Missing required permissions: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    // 3. Organizational Scope Hardening
    const buildingId = query.buildingId || body.buildingId || params.buildingId;
    const programId = query.programId || body.programId || params.programId;
    const line = query.line || body.line || params.line;

    if (user.scopes) {
      // Building Check
      if (buildingId && user.scopes.buildings?.length > 0) {
        if (!user.scopes.buildings.includes(buildingId)) {
          await this.logScopeViolation(user, 'Building', buildingId);
          throw new ForbiddenException(
            `Access denied for Building: ${buildingId}`,
          );
        }
      }

      // Program Check
      if (programId && user.scopes.programs?.length > 0) {
        if (!user.scopes.programs.includes(programId)) {
          await this.logScopeViolation(user, 'Program', programId);
          throw new ForbiddenException(
            `Access denied for Program: ${programId}`,
          );
        }
      }

      // Line Check
      if (line && user.scopes.lines?.length > 0) {
        const lineNum = parseInt(line, 10);
        if (!user.scopes.lines.includes(lineNum)) {
          await this.logScopeViolation(user, 'Line', String(line));
          throw new ForbiddenException(`Access denied for Line: ${line}`);
        }
      }
    }

    return true;
  }

  private async logScopeViolation(user: any, dimension: string, value: string) {
    await this.audit.log({
      actor: user.email,
      action: 'SCOPE_VIOLATION',
      entity: dimension,
      entityId: value,
      result: 'DENIED',
      reason: `Unauthorized access attempt to ${dimension}: ${value}`,
      scope: user.scopes,
    });
  }
}
