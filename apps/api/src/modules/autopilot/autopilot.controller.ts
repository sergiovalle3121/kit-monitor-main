import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AutopilotService } from './autopilot.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('autopilot')
export class AutopilotController {
  constructor(private readonly autopilot: AutopilotService) {}

  @Get('proposals')
  @RequirePermissions('ADMIN_ACCESS')
  listProposals(
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.autopilot.listProposals(status, tenantId);
  }

  @Post('proposals/:id/execute')
  @RequirePermissions('ADMIN_ACCESS')
  executeProposal(
    @Param('id') id: string,
    @Request() req?: any,
  ) {
    const actor = req.user?.username || req.user?.email;
    return this.autopilot.executeProposal(+id, actor);
  }

  @Post('proposals/:id/dismiss')
  @RequirePermissions('ADMIN_ACCESS')
  dismissProposal(
    @Param('id') id: string,
    @Request() req?: any,
  ) {
    const actor = req.user?.username || req.user?.email;
    return this.autopilot.dismissProposal(+id, actor);
  }
}
