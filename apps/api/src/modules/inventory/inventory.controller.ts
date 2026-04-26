import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';
import { InventoryTransactionType } from './entities/inventory-movement.entity';
import { MaterialMaster } from './entities/material-master.entity';

@ApiTags('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('positions')
  @ApiOperation({
    summary: 'List inventory positions scoped to the current tenant',
  })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'partNumber', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'holdStatus', required: false })
  getPositions(
    @Query('warehouseId') warehouseId?: string,
    @Query('partNumber') partNumber?: string,
    @Query('programId') programId?: string,
    @Query('holdStatus') holdStatus?: string,
  ) {
    return this.inventoryService.findAllPositions({
      warehouseId,
      partNumber,
      programId,
      holdStatus,
    });
  }

  @Get('movements')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'List inventory movements for the current tenant' })
  @ApiQuery({ name: 'partNumber', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMovements(
    @Query('partNumber') partNumber?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getMovements({
      partNumber,
      warehouseId,
      type,
      limit,
    });
  }

  @Get('materials')
  @ApiOperation({
    summary: 'List material master records for the current tenant',
  })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  getMaterials(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.findAllMaterials({ category, search });
  }

  @Post('transaction')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Record an inventory movement transaction' })
  async recordTransaction(
    @Body()
    dto: {
      type: InventoryTransactionType;
      partNumber: string;
      quantity: number;
      fromWarehouseId?: string;
      toWarehouseId?: string;
      fromLocation?: string;
      toLocation?: string;
      programId?: string;
      actorName?: string;
      referenceType?: string;
      referenceId?: string;
      reason?: string;
    },
  ) {
    await this.inventoryService.ensureMaterial({ partNumber: dto.partNumber });
    return this.inventoryService.recordTransaction(dto);
  }

  @Post('materials')
  @RequirePermissions('admin:write')
  @ApiOperation({ summary: 'Create or retrieve a material master record' })
  createMaterial(@Body() dto: Partial<MaterialMaster>) {
    return this.inventoryService.ensureMaterial(dto);
  }
}
