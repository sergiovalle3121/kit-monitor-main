import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../services/authorization.service';

/**
 * PermissionsGuard - Guard that validates user permissions for protected endpoints.
 * 
 * This guard:
 * 1. Extracts userId and tenantId from the authenticated user (JWT payload)
 * 2. Reads the required permission from @RequirePermission decorator
 * 3. Uses AuthorizationService to check if user has the required permission
 * 4. Throws ForbiddenException if permission is missing
 * 
 * Usage on controllers:
 * @UseGuards(PermissionsGuard)
 * @RequirePermission('finance', 'write')
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the required permission from decorator metadata
    const permissionMetadata = this.reflector.get<{
      resource: string;
      action: string;
    }>('permission', context.getHandler());

    // If no permission is required, allow access
    if (!permissionMetadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Validate user is authenticated
    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const { resource, action } = permissionMetadata;
    const userId = user.userId;
    const tenantId = user.tenant_id;

    // Check if user has the required permission
    const hasPermission = await this.authorizationService.hasPermission(
      userId,
      tenantId,
      resource,
      action,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied: Missing permission '${resource}:${action}'`,
      );
    }

    return true;
  }
}
