import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MrpService } from './mrp.service';

/**
 * MRP — net requirements planning. Explodes a BOM for a build quantity, nets the
 * gross material demand against on-hand + in-transit inventory, and returns
 * shortage + suggested-order rows (make/buy aware). Read-only planning view.
 */
@ApiTags('MRP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mrp')
export class MrpController {
  constructor(private readonly service: MrpService) {}

  @Get(':bomNodeId/netting')
  @ApiOperation({ summary: 'Requerimiento neto y sugerencias de orden para un BOM.' })
  netting(
    @Param('bomNodeId') bomNodeId: string,
    @Query('qty') qty?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.netting(bomNodeId, qty ? Number(qty) : undefined, warehouseId);
  }
}
