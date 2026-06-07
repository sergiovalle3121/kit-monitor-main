import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LineControlTowerService } from './line-control-tower.service';

/**
 * Line Control Tower (Block L) — readiness, plan vs real, andons, holds and
 * replenishment per line with a worst-of light. Read-only; production:read.
 */
@ApiTags('Line Control Tower')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('line-control-tower')
export class LineControlTowerController {
  constructor(private readonly service: LineControlTowerService) {}

  @Get('summary')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Resumen por línea: readiness, plan vs real, andons, holds, reposición.' })
  summary() {
    return this.service.summary();
  }
}
