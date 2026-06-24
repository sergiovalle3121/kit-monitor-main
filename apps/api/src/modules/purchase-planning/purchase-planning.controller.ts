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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PurchasePlanningService } from './purchase-planning.service';

/**
 * Purchase planning — turns MRP shortages into purchase orders. Groups the net
 * requirement by supplier (preferred AVL manufacturer) and creates one PO per
 * group via the existing procurement service. Closes the planning→purchasing loop.
 */
@ApiTags('Planeación de Compras')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-planning')
export class PurchasePlanningController {
  constructor(private readonly service: PurchasePlanningService) {}

  @Get(':bomNodeId/suggest')
  @ApiOperation({ summary: 'Sugiere órdenes de compra (faltantes del MRP por proveedor).' })
  suggest(
    @Param('bomNodeId') bomNodeId: string,
    @Query('qty') qty?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.suggest(bomNodeId, qty ? Number(qty) : undefined, warehouseId);
  }

  @Post(':bomNodeId/generate')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Crea las órdenes de compra sugeridas (una por proveedor).' })
  generate(
    @Param('bomNodeId') bomNodeId: string,
    @Body() body: { qty?: number; warehouseId?: string; requiredDate?: string },
  ) {
    return this.service.generate(
      bomNodeId,
      body?.qty,
      body?.warehouseId,
      body?.requiredDate,
    );
  }
}
