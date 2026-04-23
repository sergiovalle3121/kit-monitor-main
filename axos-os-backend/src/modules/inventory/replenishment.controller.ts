import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ReplenishmentService } from './replenishment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('replenishment')
export class ReplenishmentController {
  constructor(private readonly replenishmentService: ReplenishmentService) {}

  @Get('rules')
  @RequirePermissions('materials:read')
  async getRules(@Request() req: any) {
    return this.replenishmentService.getRules(req.user);
  }

  @Post('rules')
  @RequirePermissions('materials:write')
  async createRule(@Body() dto: any, @Request() req: any) {
    return this.replenishmentService.createRule(dto, req.user);
  }

  @Get('analyze')
  @RequirePermissions('materials:read')
  async analyze(@Request() req: any) {
    return this.replenishmentService.analyzeInventory(req.user);
  }
}
