import { Controller, Get, Patch, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { GovernanceAnalyticsService } from './governance-analytics.service';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('governance')
export class GovernanceController {
  constructor(
    private readonly governanceService: GovernanceService,
    private readonly analytics: GovernanceAnalyticsService,
    private readonly maintenance: MaintenanceService,
  ) {}

  @Get('master-data')
  @RequirePermissions('ADMIN_ACCESS')
  getMasterData() {
    return this.governanceService.getMasterData();
  }

  // Vacía la operación (planes, BOM, materiales, kits, WO, solicitudes, envíos,
  // NCR, costos…). Preserva usuarios, organización y configuración. Sólo admin.
  @Post('reset-operational')
  @RequirePermissions('ADMIN_ACCESS')
  resetOperational() {
    return this.maintenance.resetOperationalData();
  }

  @Get('logs')
  @RequirePermissions('ADMIN_ACCESS')
  getLogs(@Query('limit') limit: number) {
    return this.governanceService.getLogs(limit);
  }

  @Get('notifications')
  @RequirePermissions('ADMIN_ACCESS')
  getMyNotifications(@Request() req: any) {
    return this.governanceService.getMyNotifications(req.user.email);
  }

  @Patch('notifications/:id/read')
  @RequirePermissions('ADMIN_ACCESS')
  markNotificationAsRead(@Param('id') id: string, @Request() req: any) {
    return this.governanceService.markNotificationAsRead(+id, req.user.email);
  }

  @Post('exceptions/check-escalations')
  @RequirePermissions('ADMIN_ACCESS')
  checkEscalations() {
    return this.governanceService.checkEscalations();
  }

  @Get('analytics/trends')
  @RequirePermissions('ADMIN_ACCESS')
  getTrends(@Request() req: any, @Query('days') days: number) {
    return this.analytics.getTrends(req.user, days || 30);
  }

  @Get('analytics/domains')
  @RequirePermissions('ADMIN_ACCESS')
  getDomainAnalytics(@Request() req: any) {
    return this.analytics.getDomainAnalytics(req.user);
  }

  @Get('analytics/friction')
  @RequirePermissions('ADMIN_ACCESS')
  getFriction(@Request() req: any) {
    return this.analytics.getOrganizationalFriction(req.user);
  }

  @Get('users')
  @RequirePermissions('ADMIN_ACCESS')
  getUsers() {
    return this.governanceService.getUsers();
  }

  @Patch('users/:id')
  @RequirePermissions('ADMIN_ACCESS')
  updateUser(@Param('id') id: string, @Body() dto: any) {
    return this.governanceService.updateUser(id, dto);
  }

  @Get('audit-logs')
  @RequirePermissions('ADMIN_ACCESS')
  getAuditLogs() {
    return this.governanceService.getAuditLogs();
  }

  @Get('exceptions')
  @RequirePermissions('ADMIN_ACCESS')
  getExceptions(@Request() req: any, @Query() filters: any) {
    return this.governanceService.getExceptions(req.user, filters);
  }

  @Get('exceptions/summary')
  @RequirePermissions('ADMIN_ACCESS')
  getExceptionSummary(@Request() req: any) {
    return this.governanceService.getExceptionSummary(req.user);
  }

  @Patch('exceptions/:id/status')
  @RequirePermissions('ADMIN_ACCESS')
  updateExceptionStatus(@Param('id') id: string, @Body('status') status: any, @Request() req: any) {
    return this.governanceService.updateExceptionStatus(+id, status, req.user.email || req.user.username);
  }

  @Patch('exceptions/:id/assign')
  @RequirePermissions('ADMIN_ACCESS')
  assignException(@Param('id') id: string, @Body('assignee') assignee: string, @Request() req: any) {
    return this.governanceService.assignException(+id, req.user.email || req.user.username, assignee);
  }

  @Patch('exceptions/:id/resolve')
  @RequirePermissions('ADMIN_ACCESS')
  resolveException(
    @Param('id') id: string, 
    @Body() body: { reason: string, comments?: string }, 
    @Request() req: any
  ) {
    return this.governanceService.resolveException(+id, req.user.email || req.user.username, body);
  }
}
