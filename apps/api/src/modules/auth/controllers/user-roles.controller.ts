import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermission } from '../decorators/permissions.decorator';
import { AuthorizationService } from '../services/authorization.service';
import { AssignRoleDto } from '../dto/role.dto';

/**
 * UserRolesController - Admin endpoints for managing user role assignments.
 * 
 * All endpoints are protected with JWT authentication and require 'auth:write' permission.
 * These endpoints allow managing which roles are assigned to users within specific tenants.
 */
// Global prefix `api` is applied in main.ts; `'api/users'` would double-mount at
// `/api/api/users`. The intended surface is `/api/users/:userId/roles`.
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserRolesController {
  constructor(
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * GET /api/users/:userId/roles?tenantId=xxx - List roles assigned to a user in a tenant
   */
  @Get(':userId/roles')
  @RequirePermission('auth', 'write')
  async getUserRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    const roleAssignments =
      await this.authorizationService.getUserRoleAssignments(userId, tenantId);

    return roleAssignments.map((assignment) => ({
      id: assignment.id,
      role: assignment.role,
      plant: assignment.plant,
      plantId: assignment.plantId,
      createdAt: assignment.createdAt,
    }));
  }

  /**
   * POST /api/users/:userId/roles - Assign a role to a user
   * Body: { roleId, tenantId, plantId? }
   */
  @Post(':userId/roles')
  @RequirePermission('auth', 'write')
  async assignRoleToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AssignRoleDto,
  ) {
    return await this.authorizationService.assignRoleToUser(
      userId,
      body.roleId,
      body.tenantId,
      body.plantId ?? null,
    );
  }

  /**
   * DELETE /api/users/:userId/roles/:userRoleId - Revoke a role assignment from a user
   */
  @Delete(':userId/roles/:userRoleId')
  @RequirePermission('auth', 'write')
  async revokeUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('userRoleId', ParseUUIDPipe) userRoleId: string,
  ) {
    await this.authorizationService.revokeUserRole(userRoleId);
    return { message: 'Role revoked successfully' };
  }
}
