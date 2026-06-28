import { Controller, Post, UseGuards } from '@nestjs/common';
import { RolesSeederService } from '../services/roles-seeder.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequirePermission } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';

/**
 * SeedController - Temporary endpoints for seeding initial data.
 * 
 * These endpoints should be removed or heavily protected in production.
 * They are intended for initial setup and development only.
 */
// Global prefix `api` is applied in main.ts; `'api/seed'` would double-mount at
// `/api/api/seed`. The intended surface is `/api/seed/roles`.
@Controller('seed')
export class SeedController {
  constructor(private readonly rolesSeederService: RolesSeederService) {}

  /**
   * POST /api/seed/roles - Seed default roles and permissions
   * This endpoint is idempotent - safe to call multiple times.
   */
  @Post('roles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('auth', 'write')
  async seedRoles() {
    const result = await this.rolesSeederService.seed();
    return {
      message: 'Roles and permissions seeded successfully',
      ...result,
    };
  }
}
