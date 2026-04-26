import { Controller, Get, Post, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryPosition } from './entities/inventory-position.entity';
import { InventoryMovement, InventoryTransactionType } from './entities/inventory-movement.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('positions')
  async getPositions(
    @Request() req: any,
    @Query('warehouseId') warehouseId?: string,
    @Query('partNumber') partNumber?: string,
    @Query('programId') programId?: string,
  ): Promise<InventoryPosition[]> {
    return this.inventoryService.findAllPositions(req.user, { warehouseId, partNumber, programId });
  }

  @Get('movements')
  @RequirePermissions('materials:read')
  async getMovements(
    @Request() req: any,
    @Query('partNumber') partNumber?: string,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<InventoryMovement[]> {
    return this.inventoryService.getMovements(req.user, { partNumber, warehouseId });
  }

  @Post('transaction')
  @RequirePermissions('materials:write')
  async recordTransaction(
    @Request() req: any,
    @Body() dto: {
      type: InventoryTransactionType;
      partNumber: string;
      quantity: number;
      fromWarehouseId?: string;
      toWarehouseId?: string;
      fromLocation?: string;
      toLocation?: string;
      programId?: string;
      actorName: string;
      referenceType?: string;
      referenceId?: string;
      reason?: string;
    },
  ): Promise<InventoryMovement> {
    // Ensure material exists in Master Data (Practical for Phase 1 integration)
    await this.inventoryService.ensureMaterial({ partNumber: dto.partNumber });
    return this.inventoryService.recordTransaction(dto);
  }

  @Post('master-data')
  @RequirePermissions('admin:write')
  async createMaterial(@Request() req: any, @Body() dto: any) {
    return this.inventoryService.ensureMaterial(dto, req.user);
  }
}
