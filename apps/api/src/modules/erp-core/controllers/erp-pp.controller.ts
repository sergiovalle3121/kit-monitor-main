import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { ErpPpService } from '../services/erp-pp.service';
import type { RunMrpInput } from '../services/erp-pp.service';

type AuthRequest = { user?: { email?: string } };
const actor = (req: AuthRequest) => req?.user?.email ?? 'system';

@ApiTags('ERP · Producción (PP/MRP)')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('erp/pp')
export class ErpPpController {
  constructor(private readonly pp: ErpPpService) {}

  // MRP (PP02 / MD01)
  @Post('mrp/run')
  @RequirePermissions('production:write')
  runMrp(@Body() dto: RunMrpInput, @Request() req: AuthRequest) {
    return this.pp.runMrp({ ...dto, createdBy: dto.createdBy ?? actor(req) });
  }
  @Get('mrp/runs')
  @RequirePermissions('production:read')
  runs() {
    return this.pp.listRuns();
  }
  @Get('mrp/runs/:id')
  @RequirePermissions('production:read')
  run(@Param('id', ParseIntPipe) id: number) {
    return this.pp.getRun(id);
  }

  // Planned orders (PP03)
  @Get('planned-orders')
  @RequirePermissions('production:read')
  plannedOrders(
    @Query('status') status?: string,
    @Query('mrpRunId') mrpRunId?: string,
  ) {
    return this.pp.listPlannedOrders({
      status,
      mrpRunId: mrpRunId ? Number(mrpRunId) : undefined,
    });
  }
  @Post('planned-orders/:id/release')
  @RequirePermissions('production:write')
  release(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.pp.releasePlannedOrder(id, actor(req));
  }
  @Post('planned-orders/:id/cancel')
  @RequirePermissions('production:write')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.pp.cancelPlannedOrder(id);
  }
}
