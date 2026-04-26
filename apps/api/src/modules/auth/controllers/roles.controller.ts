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

/**
 * DTO for assigning a permission to a role
 */
interface AssignPermissionDto {
  permissionId: string;
}

/**
 * DTO for assigning a role to a user
 */
interface AssignRoleDto {
  roleId: string;
  tenantId: string;
  plantId?: string | null;
}

/**
 * RolesController - Admin endpoints for managing roles and permissions.
 * 
 * All endpoints are protected with JWT authentication and require 'auth:write' permission.
 * These endpoints are intended for SystemAdmin users only.
 */
@Controller('api/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * GET /api/roles - List all system roles with their permissions
   */
  @Get()
  @RequirePermission('auth', 'write')
  async getAllRoles() {
    return await this.authorizationService.getAllRoles();
  }

  /**
   * GET /api/roles/:id/permissions - Get permissions for a specific role
   */
  @Get(':id/permissions')
  @RequirePermission('auth', 'write')
  async getRolePermissions(@Param('id', ParseUUIDPipe) id: string) {
    return await this.authorizationService.getRolePermissions(id);
  }

  /**
   * POST /api/roles/:id/permissions - Assign a permission to a role
   */
  @Post(':id/permissions')
  @RequirePermission('auth', 'write')
  async assignPermissionToRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignPermissionDto,
  ) {
    return await this.authorizationService.assignPermissionToRole(
      id,
      body.permissionId,
    );
  }

  /**
   * DELETE /api/roles/:id/permissions/:permissionId - Remove a permission from a role
   */
  @Delete(':id/permissions/:permissionId')
  @RequirePermission('auth', 'write')
  async removePermissionFromRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    await this.authorizationService.removePermissionFromRole(id, permissionId);
    return { message: 'Permission removed successfully' };
  }
}
