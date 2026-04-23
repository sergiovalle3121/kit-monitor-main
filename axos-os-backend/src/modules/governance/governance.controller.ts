import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('master-data')
  @RequirePermissions('ADMIN_ACCESS')
  getMasterData() {
    return this.governanceService.getMasterData();
  }

  @Get('users')
  @RequirePermissions('ADMIN_ACCESS')
  getUsers() {
    return this.governanceService.getUsers();
  }

  @Patch('users/:id')
  @RequirePermissions('ADMIN_ACCESS')
  updateUser(@Param('id') id: string, @Body() dto: any) {
    return this.governanceService.updateUser(+id, dto);
  }

  @Get('audit-logs')
  @RequirePermissions('ADMIN_ACCESS')
  getAuditLogs() {
    return this.governanceService.getAuditLogs();
  }
}
