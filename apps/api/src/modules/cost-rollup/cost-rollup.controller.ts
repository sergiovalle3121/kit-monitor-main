import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CostRollupService } from './cost-rollup.service';

@Controller('cost-rollup')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CostRollupController {
  constructor(private readonly costRollupService: CostRollupService) {}

  @Get()
  @RequirePermission('finance', 'read')
  getRollup(@Query('workOrderId') workOrderId?: string) {
    return this.costRollupService.getRollup({ workOrderId });
  }

  @Post('seed')
  @RequirePermission('finance', 'write')
  seed() {
    return this.costRollupService.seedCurrentTenant();
  }
}
