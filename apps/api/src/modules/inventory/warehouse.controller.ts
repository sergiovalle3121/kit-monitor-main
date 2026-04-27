import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('tasks')
  @RequirePermissions('materials:read')
  async getTasks(@Query() filters: any, @Request() req: any) {
    return this.warehouseService.findAllTasks(filters, req.user);
  }

  @Post('tasks')
  @RequirePermissions('materials:write')
  async createTask(@Body() dto: any, @Request() req: any) {
    return this.warehouseService.createTask(dto, req.user);
  }

  @Patch('tasks/:id/start')
  @RequirePermissions('materials:write')
  async startTask(@Param('id') id: number, @Body('actor') actor: string, @Request() req: any) {
    return this.warehouseService.startTask(id, actor, req.user);
  }

  @Patch('tasks/:id/complete')
  @RequirePermissions('materials:write')
  async completeTask(@Param('id') id: number, @Body('actor') actor: string, @Request() req: any) {
    return this.warehouseService.completeTask(id, actor, req.user);
  }

  // Picking
  @Get('picking/backlog')
  @RequirePermissions('materials:read')
  async getPickingBacklog(@Query('warehouseId') warehouseId: string, @Request() req: any) {
    return this.warehouseService.getPickingBacklog(warehouseId, req.user);
  }

  @Post('picking/:id/exception')
  @RequirePermissions('materials:write')
  async handleException(@Param('id') id: number, @Body() exception: any, @Request() req: any) {
    return this.warehouseService.handlePickException(id, exception, req.user);
  }
}
