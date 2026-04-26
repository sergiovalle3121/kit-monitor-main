import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ReplenishmentService } from './replenishment.service';

@ApiTags('replenishment')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('replenishment')
export class ReplenishmentController {
  constructor(private readonly replenishmentService: ReplenishmentService) {}

  @Get('rules')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'List replenishment rules for the current tenant' })
  getRules() {
    return this.replenishmentService.getRules();
  }

  @Post('rules')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Create a replenishment rule' })
  createRule(@Body() dto: any) {
    return this.replenishmentService.createRule(dto);
  }

  @Get('analyze')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'Run inventory analysis and return replenishment signals' })
  analyze() {
    return this.replenishmentService.analyzeInventory();
  }
}
