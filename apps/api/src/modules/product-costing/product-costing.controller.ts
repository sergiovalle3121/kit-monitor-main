import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ProductCostingService } from './product-costing.service';

/**
 * Product costing (Engineering / Finance). Standard cost roll-up for an assembly
 * = material (BOM explosion) + labor (routing × rate) + overhead. Complements
 * `cost-rollup` (actual costs per work order). Computed; can write the unit
 * standard cost back onto the assembly material.
 */
@ApiTags('Costeo de Producto')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('product-costing')
export class ProductCostingController {
  constructor(private readonly service: ProductCostingService) {}

  @Get(':bomNodeId/rollup')
  @ApiOperation({ summary: 'Costo estándar (material + labor + overhead) de un BOM.' })
  rollup(
    @Param('bomNodeId') bomNodeId: string,
    @Query('qty') qty?: string,
    @Query('laborRatePerHour') laborRatePerHour?: string,
    @Query('overheadPct') overheadPct?: string,
  ) {
    return this.service.rollup(bomNodeId, qty ? Number(qty) : undefined, {
      laborRatePerHour: laborRatePerHour ? Number(laborRatePerHour) : undefined,
      overheadPct: overheadPct ? Number(overheadPct) : undefined,
    });
  }

  @Post(':bomNodeId/apply')
  @ApiOperation({ summary: 'Guarda el costo unitario calculado como costo estándar del material.' })
  apply(
    @Param('bomNodeId') bomNodeId: string,
    @Body() body: { qty?: number; laborRatePerHour?: number; overheadPct?: number },
  ) {
    return this.service.applyStandardCost(bomNodeId, body?.qty, {
      laborRatePerHour: body?.laborRatePerHour,
      overheadPct: body?.overheadPct,
    });
  }
}
